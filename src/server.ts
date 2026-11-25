import { createApp } from "./app";
import { createContainer } from "./container";

const container = createContainer();
const app = createApp(container);

app.listen(container.config.PORT, () => {
    console.log(`API La Roulotte sur http://localhost:${container.config.PORT}`);
})
