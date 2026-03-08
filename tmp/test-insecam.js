const insecam = require("insecam-api");

async function test() {
    try {
        console.log("Fetching highest rated...");
        const rated = await insecam.rating;
        console.log("Rated IDs:", rated);

        if (rated && rated.length > 0) {
            console.log(`Fetching details for camera ${rated[0]}...`);
            const details = await insecam.camera(rated[0]);
            console.log("Camera Details:", JSON.stringify(details, null, 2));
        }

        console.log("Fetching new...");
        const newCams = await insecam.new;
        console.log("New IDs:", newCams);
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
