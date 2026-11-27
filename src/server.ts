import { createApp } from "./app";
import { createContainer } from "./container";
import { logger } from "./shared/logger";

const container = createContainer();
const app = createApp(container);

app.listen(container.config.PORT, () => {
    logger.info(`API La Roulotte sur http://localhost:${container.config.PORT}`);
})
