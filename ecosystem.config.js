module.exports = {
    apps: [
      {
        name: "server",
        script: "./server.js",
      },
      {
        name: "telegram-alerts",
        script: "./public/telegram-alerts.js",
      },
      {
        name: "telegram-alerts-screenshots",
        script: "./public/telegram-alerts-screenshots.js",
      },
      {
        name: "screenshot",
        script: "./public/screenshot.js",
      },
    ],
  };
  