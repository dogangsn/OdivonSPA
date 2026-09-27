"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_middleware_1 = require("./middleware/cors.middleware");
const auth_middleware_1 = require("./middleware/auth.middleware");
const internal_auth_middleware_1 = require("./middleware/internal-auth.middleware");
const errors_1 = require("./lib/errors");
const health_routes_1 = require("./routes/health.routes");
const tenants_routes_1 = require("./routes/tenants.routes");
const staff_routes_1 = require("./routes/staff.routes");
const pos_routes_1 = require("./routes/pos.routes");
const payments_routes_1 = require("./routes/payments.routes");
const commissions_routes_1 = require("./routes/commissions.routes");
const cash_register_routes_1 = require("./routes/cash-register.routes");
const packages_routes_1 = require("./routes/packages.routes");
const appointments_routes_1 = require("./routes/appointments.routes");
const internal_routes_1 = require("./routes/internal.routes");
function createApp() {
    const app = (0, express_1.default)();
    // Render sits behind a reverse proxy; needed for req.ip / x-forwarded-for to resolve correctly.
    app.set('trust proxy', true);
    app.use(cors_middleware_1.corsMiddleware);
    app.use(express_1.default.json());
    app.use(health_routes_1.healthRouter);
    app.use('/api', auth_middleware_1.authMiddleware, tenants_routes_1.tenantsRouter);
    app.use('/api', auth_middleware_1.authMiddleware, staff_routes_1.staffRouter);
    app.use('/api', auth_middleware_1.authMiddleware, pos_routes_1.posRouter);
    app.use('/api', auth_middleware_1.authMiddleware, payments_routes_1.paymentsRouter);
    app.use('/api', auth_middleware_1.authMiddleware, commissions_routes_1.commissionsRouter);
    app.use('/api', auth_middleware_1.authMiddleware, cash_register_routes_1.cashRegisterRouter);
    app.use('/api', auth_middleware_1.authMiddleware, packages_routes_1.packagesRouter);
    app.use('/api', auth_middleware_1.authMiddleware, appointments_routes_1.appointmentsRouter);
    app.use('/internal', internal_auth_middleware_1.internalAuthMiddleware, internal_routes_1.internalRouter);
    app.use(errors_1.errorMiddleware);
    return app;
}
//# sourceMappingURL=app.js.map