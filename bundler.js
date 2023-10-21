const fs = require("fs");
const path = require("path");
const babelParser = require("@babel/parser");
const babelTraverse = require("@babel/traverse").default;
const babelCore = require("@babel/core");

let ID = 0;

const createAsset = (filename) => {
  const fileContent = fs.readFileSync(filename, "utf-8");

  const ast = babelParser.parse(fileContent, {
    sourceType: "module",
  });

  const dependencies = [];

  babelTraverse(ast, {
    ImportDeclaration: ({ node }) => {
      dependencies.push(node.source.value);
    },
  });

  const { code } = babelCore.transformFromAstSync(ast, null, {
    presets: ["@babel/preset-env"],
  });

  return {
    id: ++ID,
    filename,
    dependencies,
    code,
  };
};

const createDependencyGraph = (entryFilename) => {
  const entryAsset = createAsset(entryFilename);

  const depeendencyGraph = [entryAsset];

  for (const asset of depeendencyGraph) {
    const dirname = path.dirname(asset.filename);

    asset.mapping = {};

    asset.dependencies.forEach((relativePath) => {
      const absolutePath = path.join(dirname, relativePath);
      const childAsset = createAsset(absolutePath);

      asset.mapping[relativePath] = childAsset.id;
      depeendencyGraph.push(childAsset);
    });
  }
  console.log(depeendencyGraph);

  return depeendencyGraph;
};

const createBundle = (entryFilename) => {
  const depeendencyGraph = createDependencyGraph(entryFilename);

  // 0: [code, mapping], 1: []
  let modules = ``;

  depeendencyGraph.forEach((module) => {
    modules += `
            ${module.id}: [
                function (require, module, exports) {
                    ${module.code}
                },
                ${JSON.stringify(module.mapping)}
            ]
        `;
  });

  const bundle = `
        (function(modules) {
            function require(moduleID) {
                const [fn, mapping] = modules[moduleID];

                function localRequire(relativePath) {
                    return require(mapping[relativePath]);
                }

                const module = { exports: {}}

                fn(localRequire, module, module.exports);

                return module.exports;
            }

            require(0);
        }) {
            ${modules}
        }
    `;

  return bundle;
};

const finalOutput = createBundle("./src/entry.js");

if (!fs.existsSync("dist")) {
  fs.mkdirSync("dist");
}

fs.writeFileSync("dist/bundle.js", finalOutput, "utf-8");
