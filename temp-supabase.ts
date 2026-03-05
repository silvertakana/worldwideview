import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function run() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    console.log("Fetching latest timestamp...");
    console.time("timestampQuery");
    const { data: latestTS, error: tsError } = await supabase
        .from("aviation_history")
        .select("timestamp")
        .order("timestamp", { ascending: false })
        .limit(1);
    console.timeEnd("timestampQuery");

    if (tsError) {
        console.error("Timestamp Error:", tsError);
        return;
    }

    if (!latestTS || latestTS.length === 0) {
        console.log("No data found.");
        return;
    }

    const ts = latestTS[0].timestamp;
    console.log("Latest timestamp:", ts);

    console.log("Fetching records...");
    console.time("recordsQuery");
    const { data: records, error: recError } = await supabase
        .from("aviation_history")
        .select("*")
        .eq("timestamp", ts);
    console.timeEnd("recordsQuery");

    if (recError) {
        console.error("Records Error:", recError);
    } else {
        console.log(`Found ${records?.length} records.`);
    }
}

run().catch(console.error);
