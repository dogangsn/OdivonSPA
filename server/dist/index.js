"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = require("./app");
const port = Number(process.env.PORT ?? 8787);
(0, app_1.createApp)().listen(port, () => {
    console.log(`odivon-spa-server listening on :${port}`);
});
//# sourceMappingURL=index.js.map