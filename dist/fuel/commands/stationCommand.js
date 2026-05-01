"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerStationCommand = void 0;
const formatting_1 = require("../lib/formatting");
const output_1 = require("../lib/output");
const shared_1 = require("./shared");
const registerStationCommand = (program, fuelService) => {
    const command = (0, shared_1.addOutputOptions)(program.command("station <query>"))
        .description("Inspect a station by node ID or cached local text match")
        .option("--refresh", "Refresh cached Fuel Finder data before querying")
        .showHelpAfterError()
        .addHelpText("after", '\nExamples:\n  fuel station "0028acef..."\n  fuel station "tesco watford"\n  fuel station "SL6 0AA" --json');
    command.action(async (query, options, commandInstance) => {
        const outputOptions = (0, output_1.withGlobalOutputOptions)(commandInstance, options);
        await (0, output_1.runCommand)("station", outputOptions, () => fuelService.findStation(query, {
            refresh: options.refresh ?? false
        }), formatting_1.formatStationText, {
            projectionExamples: [
                "station.nodeId",
                "station.prices.0.pencePerLitre",
                "station.location.postcode"
            ]
        });
    });
};
exports.registerStationCommand = registerStationCommand;
