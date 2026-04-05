#!/usr/bin/env node
import { scaffold } from "./scaffold.js";

const name = process.argv[2];
if (!name) {
    console.error("Usage: npx @worldwideview/create-plugin <plugin-name>");
    process.exit(1);
}

scaffold(name);
