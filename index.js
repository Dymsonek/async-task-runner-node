const { createApp } = require('./server');
const PORT = process.env.PORT || 3000;
const app = createApp();
if (require.main === module) {
  app.listen(PORT, () => console.log(`Task runner listening on port ${PORT}`));
}
