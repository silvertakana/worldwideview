#!/usr/bin/env node
import { scaffold } from "./scaffold.js";
import * as readline from "node:readline/promises";

async function main() {
    let name = process.argv[2];
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    if (!name) {
        name = await rl.question("Plugin name (e.g. my-custom-aviation): ");
    }

    if (!name) {
        console.error("Usage: npx @worldwideview/create-plugin <plugin-name>");
        process.exit(1);
    }

    console.log("\nWhat type of plugin do you want to create?");
    console.log("1. Frontend-Only (Connects to existing REST APIs or your private backend)");
    console.log("2. Full-Stack (Includes a Fastify backend seeder for the Data Engine)");
    
    let type = await rl.question("\nEnter choice (1 or 2): ");
    
    rl.close();

    const templateType = type.trim() === "2" ? "fullstack" : "frontend";

    scaffold(name, templateType);
}

main().catch(console.error);
