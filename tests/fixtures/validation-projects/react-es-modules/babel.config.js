module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        modules: false,
        targets: {
          node: "current"
        }
      }
    ],
    [
      "@babel/preset-react",
      {
        runtime: "automatic"
      }
    ]
  ],
  env: {
    test: {
      presets: [
        [
          "@babel/preset-env",
          {
            modules: "auto",
            targets: {
              node: "current"
            }
          }
        ],
        [
          "@babel/preset-react",
          {
            runtime: "automatic"
          }
        ]
      ]
    }
  }
};