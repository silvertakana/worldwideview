const insecam = require("insecam-api");

async function check() {
    try {
        const rated = await insecam.rating;
        const newCams = await insecam.new;
        console.log(`Rating length: ${rated?.length}`);
        console.log(`New length: ${newCams?.length}`);
    } catch(e) {
        console.error(e);
    }
}
check();
