
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_KEY!;
    const supabase = createClient(url, key);

    console.log("Generating link...");
    const { data, error } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: "test-user@phone.musait.app",
    });

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Data properties keys:", Object.keys(data.properties));
        console.log("action_link:", data.properties.action_link);
        console.log("email_otp:", data.properties.email_otp);
        console.log("hashed_token:", data.properties.hashed_token);

        // Extract token from URL
        const actionUrl = new URL(data.properties.action_link);
        const urlToken = actionUrl.searchParams.get("token");
        console.log("Token from URL:", urlToken);

        console.log("Match?", data.properties.hashed_token === urlToken ? "YES (Identical)" : "NO (Different)");
    }
}

main().catch(console.error);
