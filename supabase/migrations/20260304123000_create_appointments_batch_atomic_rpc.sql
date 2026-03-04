-- ============================================================
-- Atomic multi-appointment creation RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_appointments_batch_atomic(
  p_tenant_id uuid,
  p_customer_phone text,
  p_customer_name text,
  p_staff_id uuid,
  p_date date,
  p_start_time time,
  p_service_names text[],
  p_require_atomic boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_existing_customer_name text;
  v_service_name text;
  v_service_id uuid;
  v_service_count integer;
  v_service_duration integer;
  v_current_start timestamptz;
  v_current_end timestamptz;
  v_staff_ok boolean;
  v_slot_conflict boolean;
  v_items jsonb := '[]'::jsonb;
  v_created jsonb := '[]'::jsonb;
  v_item jsonb;
  v_appointment_id uuid;
  v_appointment_count integer := 0;
BEGIN
  IF p_tenant_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'validation_error',
      'error', 'tenant_id zorunludur.'
    );
  END IF;

  IF p_staff_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'validation_error',
      'error', 'staff_id zorunludur.'
    );
  END IF;

  IF p_date IS NULL OR p_start_time IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'validation_error',
      'error', 'date ve start_time zorunludur.'
    );
  END IF;

  IF p_service_names IS NULL OR coalesce(array_length(p_service_names, 1), 0) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'validation_error',
      'error', 'service_names en az bir öğe içermelidir.'
    );
  END IF;

  IF p_customer_phone IS NULL OR btrim(p_customer_phone) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'validation_error',
      'error', 'customer_phone zorunludur.'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM staff s
    WHERE s.id = p_staff_id
      AND s.tenant_id = p_tenant_id
      AND coalesce(s.is_active, true) = true
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'staff_not_found',
      'error', 'Seçilen personel aktif değil veya bulunamadı.'
    );
  END IF;

  SELECT c.id, c.name
  INTO v_customer_id, v_existing_customer_name
  FROM customers c
  WHERE c.tenant_id = p_tenant_id
    AND c.phone = btrim(p_customer_phone)
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO customers (tenant_id, phone, name)
    VALUES (
      p_tenant_id,
      btrim(p_customer_phone),
      nullif(btrim(coalesce(p_customer_name, '')), '')
    )
    RETURNING id INTO v_customer_id;
  ELSIF (v_existing_customer_name IS NULL OR btrim(v_existing_customer_name) = '')
    AND nullif(btrim(coalesce(p_customer_name, '')), '') IS NOT NULL
  THEN
    UPDATE customers
    SET name = btrim(p_customer_name)
    WHERE id = v_customer_id;
  END IF;

  v_current_start := (
    (p_date::text || ' ' || to_char(p_start_time, 'HH24:MI:SS'))::timestamp
    AT TIME ZONE 'Europe/Istanbul'
  );

  FOREACH v_service_name IN ARRAY p_service_names LOOP
    v_service_name := btrim(coalesce(v_service_name, ''));
    IF v_service_name = '' THEN
      CONTINUE;
    END IF;

    SELECT
      count(*)::integer,
      min(s.id),
      min(coalesce(s.duration_minutes, s.duration_blocks * 15, 30))
    INTO v_service_count, v_service_id, v_service_duration
    FROM services s
    WHERE s.tenant_id = p_tenant_id
      AND coalesce(s.is_active, true) = true
      AND lower(s.name) = lower(v_service_name);

    IF v_service_count = 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'service_not_found',
        'error', format('"%s" hizmeti bulunamadı.', v_service_name),
        'service_name', v_service_name
      );
    END IF;

    IF v_service_count > 1 THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'service_ambiguous',
        'error', format('"%s" birden fazla hizmetle eşleşti.', v_service_name),
        'service_name', v_service_name
      );
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM service_staff ss
      WHERE ss.service_id = v_service_id
        AND ss.staff_id = p_staff_id
    )
    INTO v_staff_ok;

    IF NOT v_staff_ok THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'staff_service_mismatch',
        'error', format('Seçilen personel "%s" hizmetini vermiyor.', v_service_name),
        'service_name', v_service_name
      );
    END IF;

    v_current_end := v_current_start + make_interval(mins => v_service_duration);

    SELECT EXISTS (
      SELECT 1
      FROM appointments a
      WHERE a.tenant_id = p_tenant_id
        AND a.staff_id = p_staff_id
        AND a.status IN ('booked', 'upcoming', 'confirmed')
        AND a.start_time < v_current_end
        AND coalesce(a.end_time, a.start_time) > v_current_start
    )
    INTO v_slot_conflict;

    IF v_slot_conflict THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'slot_conflict',
        'error', format('"%s" için slot çakışması var.', v_service_name),
        'service_name', v_service_name,
        'slot_start', v_current_start
      );
    END IF;

    v_items := v_items || jsonb_build_array(
      jsonb_build_object(
        'service_id', v_service_id,
        'service_name', v_service_name,
        'start_time', v_current_start,
        'end_time', v_current_end
      )
    );

    v_current_start := v_current_end;
  END LOOP;

  IF coalesce(jsonb_array_length(v_items), 0) = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'validation_error',
      'error', 'Geçerli hizmet bulunamadı.'
    );
  END IF;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(v_items)
  LOOP
    INSERT INTO appointments (
      tenant_id,
      service_id,
      staff_id,
      customer_id,
      start_time,
      end_time,
      status,
      source,
      notes
    )
    VALUES (
      p_tenant_id,
      (v_item ->> 'service_id')::uuid,
      p_staff_id,
      v_customer_id,
      (v_item ->> 'start_time')::timestamptz,
      (v_item ->> 'end_time')::timestamptz,
      'booked',
      'whatsapp',
      format('WhatsApp batch booking (%s)', btrim(p_customer_phone))
    )
    RETURNING id INTO v_appointment_id;

    v_appointment_count := v_appointment_count + 1;
    v_created := v_created || jsonb_build_array(
      jsonb_build_object(
        'appointment_id', v_appointment_id,
        'service_id', (v_item ->> 'service_id')::uuid,
        'service_name', v_item ->> 'service_name',
        'start_time', (v_item ->> 'start_time')::timestamptz,
        'end_time', (v_item ->> 'end_time')::timestamptz,
        'staff_id', p_staff_id
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'require_atomic', coalesce(p_require_atomic, true),
    'count', v_appointment_count,
    'appointments', v_created
  );
EXCEPTION
  WHEN OTHERS THEN
    IF coalesce(p_require_atomic, true) THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'atomic_rollback',
        'error', SQLERRM
      );
    END IF;
    RETURN jsonb_build_object(
      'success', false,
      'code', 'rpc_error',
      'error', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_appointments_batch_atomic(
  uuid,
  text,
  text,
  uuid,
  date,
  time,
  text[],
  boolean
) TO authenticated, service_role;
