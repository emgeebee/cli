"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerListCommand = void 0;
const config_1 = require("../../config");
const listConfig_1 = require("../lib/listConfig");
const formatting_1 = require("../lib/formatting");
const errors_1 = require("../lib/errors");
const output_1 = require("../lib/output");
const shared_1 = require("./shared");
const registerListCommand = (program, fuelService) => {
    const configPath = (0, config_1.getConfigPath)();
    const command = (0, shared_1.addOutputOptions)(program.command("list <listName>"))
        .description(`Inspect stations from a named list in ${configPath} (fuel.lists)`)
        .option("--refresh", "Refresh cached Fuel Finder data before querying")
        .showHelpAfterError()
        .addHelpText("after", `\nExample ${configPath} section:\n  {\n    "fuel": {\n      "lists": {\n        "commute": {\n          "fuel": "B7_STANDARD",\n          "stations": [\n            { "searchText": "TESCO WATFORD", "display": "Tesco", "sort": 1 },\n            { "searchText": "MFG BLUECOATS", "sort": 2 }\n          ]\n        }\n      }\n    }\n  }\n\nRows use optional numeric "sort" (lower first). Prices are coloured by rank: cheapest 20% green, dearest 40% red.\n\nExample:\n  fuel list commute`);
    command.action(async (listName, options, commandInstance) => {
        const outputOptions = (0, output_1.withGlobalOutputOptions)(commandInstance, options);
        await (0, output_1.runCommand)("list", outputOptions, async () => {
            const config = await (0, listConfig_1.loadStationListsConfig)();
            const listDefinition = config[listName];
            if (!listDefinition) {
                throw (0, errors_1.createAppError)("NOT_FOUND", `List "${listName}" was not found in ${configPath} at fuel.lists.`);
            }
            return fuelService.findStationList(listName, {
                fuelType: listDefinition.fuel,
                queries: listDefinition.stations,
                refresh: options.refresh ?? false
            });
        }, formatting_1.formatStationListText, {
            projectionExamples: ["input.fuelType", "stations.0.selectedPricePencePerLitre", "stations.0.display"]
        });
    });
};
exports.registerListCommand = registerListCommand;
