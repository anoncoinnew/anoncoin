module.exports = {
  apps: [
    {
      name: "anoncoin-server",
      script: "blockchain/decentralized_node.py", // или твой entrypoint (index.js / server.js)
      interpreter: "python3", // если Python; для Node.js убрать эту строку
      env: {
        PORT: 5000,
        NODE_ENV: "production"
      }
    }
  ]
};
