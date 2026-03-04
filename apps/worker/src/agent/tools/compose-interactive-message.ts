interface InteractiveButton {
  id: string;
  title: string;
}

interface InteractiveListSection {
  title: string;
  rows: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
}

function sanitizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

export async function composeInteractiveMessage(
  args: Record<string, unknown>
): Promise<unknown> {
  const kind = sanitizeString(args.kind).toLowerCase();
  const body = sanitizeString(args.body);

  if (!body) {
    return {
      success: false,
      error: "Argüman hatası: 'body' zorunludur",
    };
  }

  if (kind === "buttons") {
    const rawButtons = Array.isArray(args.buttons) ? args.buttons : [];
    const buttons: InteractiveButton[] = rawButtons
      .filter(
        (button) =>
          button &&
          typeof button === "object" &&
          typeof (button as Record<string, unknown>).id === "string" &&
          typeof (button as Record<string, unknown>).title === "string"
      )
      .slice(0, 3)
      .map((button) => ({
        id: sanitizeString((button as Record<string, unknown>).id).slice(0, 256),
        title: sanitizeString((button as Record<string, unknown>).title).slice(0, 20),
      }))
      .filter((button) => button.id && button.title);

    if (buttons.length === 0) {
      return {
        success: false,
        error: "Argüman hatası: 'buttons' en az 1 geçerli öğe içermeli",
      };
    }

    const payload = { body: body.slice(0, 1024), buttons };
    return {
      success: true,
      kind: "buttons",
      payload,
      renderedMessage: `<<BUTTONS>>\n${JSON.stringify(payload)}\n<</BUTTONS>>`,
    };
  }

  if (kind === "list") {
    const buttonText = sanitizeString(args.button_text).slice(0, 20);
    if (!buttonText) {
      return {
        success: false,
        error: "Argüman hatası: 'button_text' zorunludur (list için)",
      };
    }

    const rawSections = Array.isArray(args.sections) ? args.sections : [];
    const sections: InteractiveListSection[] = rawSections
      .filter(
        (section) =>
          section &&
          typeof section === "object" &&
          typeof (section as Record<string, unknown>).title === "string" &&
          Array.isArray((section as Record<string, unknown>).rows)
      )
      .slice(0, 10)
      .map((section) => {
        const rows = ((section as Record<string, unknown>).rows as unknown[])
          .filter(
            (row) =>
              row &&
              typeof row === "object" &&
              typeof (row as Record<string, unknown>).id === "string" &&
              typeof (row as Record<string, unknown>).title === "string"
          )
          .slice(0, 10)
          .map((row) => {
            const rowObj = row as Record<string, unknown>;
            const description = sanitizeString(rowObj.description);
            return {
              id: sanitizeString(rowObj.id).slice(0, 200),
              title: sanitizeString(rowObj.title).slice(0, 24),
              ...(description ? { description: description.slice(0, 72) } : {}),
            };
          })
          .filter((row) => row.id && row.title);

        return {
          title: sanitizeString((section as Record<string, unknown>).title).slice(0, 24),
          rows,
        };
      })
      .filter((section) => section.title && section.rows.length > 0);

    if (sections.length === 0) {
      return {
        success: false,
        error: "Argüman hatası: 'sections' en az 1 geçerli bölüm içermeli",
      };
    }

    const payload = {
      body: body.slice(0, 1024),
      button: buttonText,
      sections,
    };
    return {
      success: true,
      kind: "list",
      payload,
      renderedMessage: `<<LIST>>\n${JSON.stringify(payload)}\n<</LIST>>`,
    };
  }

  return {
    success: false,
    error: "Argüman hatası: 'kind' yalnızca 'buttons' veya 'list' olabilir",
  };
}
