"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerNearCommand = void 0;
const constants_1 = require("../lib/constants");
const commandUtils_1 = require("../lib/commandUtils");
const errors_1 = require("../lib/errors");
const formatting_1 = require("../lib/formatting");
const output_1 = require("../lib/output");
const shared_1 = require("./shared");
const registerNearCommand = (program, fuelService, defaultFuelType) => {
    const command = (0, shared_1.addOutputOptions)(program.command("near <location>"))
        .description("Find stations near a UK postcode or lat,lon coordinates")
        .option("--fuel <fuelType>", `Fuel type: ${constants_1.SUPPORTED_FUEL_TYPES.join(", ")}`)
        .option("--radius <distance>", "Search radius in miles or km", commandUtils_1.parseRadiusMiles, constants_1.DEFAULT_RADIUS_MILES)
        .option("--limit <count>", "Maximum number of stations to return", commandUtils_1.parseLimit, constants_1.DEFAULT_LIMIT)
        .option("--sort <sort>", "Sort by best, price, distance, or freshest", constants_1.DEFAULT_NEAR_SORT)
        .option("--refresh", "Refresh cached Fuel Finder data before querying")
        .showHelpAfterError()
        .addHelpText("after", '\nExamples:\n  fuel near "SE1 9SG" --fuel E10\n  fuel near "SE1 9SG"   # uses fuel.defaultFuelType from ~/.phone_cli.json when set\n  fuel near "51.501,-0.141" --fuel B7_STANDARD --radius 8mi --limit 5\n  fuel near "NE1 1AA" --fuel E5 --sort freshest --json');
    command.action(async (location, options, commandInstance) => {
        const outputOptions = (0, output_1.withGlobalOutputOptions)(commandInstance, options);
        const requestedFuel = options.fuel ?? defaultFuelType;
        if (!requestedFuel) {
            throw (0, errors_1.createAppError)("INVALID_INPUT", "Missing fuel type. Pass --fuel <fuelType> or set fuel.defaultFuelType in ~/.phone_cli.json.");
        }
        await (0, output_1.runCommand)("near", outputOptions, () => fuelService.findStationsNear(location, {
            fuelType: (0, commandUtils_1.parseFuelType)(requestedFuel),
            limit: options.limit,
            radiusMiles: options.radius,
            refresh: options.refresh ?? false,
            sort: (0, commandUtils_1.parseNearSort)(options.sort)
        }), formatting_1.formatNearText, {
            projectionExamples: [
                "stations.0.selectedPricePencePerLitre",
                "stations.0.nodeId",
                "resolvedLocation.postcode"
            ]
        });
    });
};
exports.registerNearCommand = registerNearCommand;
