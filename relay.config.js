module.exports = {
    src: "./src",  // Point to src directory
    schema: "./schema.graphql",
    exclude: ["**/node_modules/**", "**/__generated__/**", "**/.next/**"],
    language: "typescript",
    artifactDirectory: "./src/__generated__"
  };