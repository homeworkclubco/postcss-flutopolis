const CSSValueParser = require("postcss-value-parser");

/**
 * @type {import('postcss').PluginCreator}
 */
module.exports = (opts = {}) => {
  return {
    postcssPlugin: "postcss-hc-fluid-variables",

    AtRule: {
      hcfluid: (atRule) => {
        const { nodes } = CSSValueParser(atRule.params);
        const params = nodes[0].nodes.filter(
          (x) =>
            ["word", "string"].includes(x.type) &&
            x.value !== "{" &&
            x.value !== "}"
        );

        const config = {
          minWidth: opts.minWidth || 320,
          maxWidth: opts.maxWidth || 1240,
          scales: { ...opts.scales },
        };

        if (!params.length) {
          atRule.remove();
          return;
        }

        let currentKey = "";
        params.forEach((node) => {
          if (node.type === "word" && node.value.includes(":")) {
            const [key, value] = node.value.split(":");
            if (key === "minWidth" || key === "maxWidth") {
              config[key] = Number(value);
            } else {
              config.scales[key] = {};
              currentKey = key;
            }
          } else if (node.type === "word" && currentKey) {
            const [step, values] = node.value.split("=");
            const [min, max] = values.split(",").map(Number);
            config.scales[currentKey][step] = [min, max];
          }
        });

        const generatedVars = {};

        Object.entries(config.scales).forEach(([prefix, values]) => {
          const keys = Object.keys(values);

          keys.forEach((key) => {
            const [min, max] = values[key];
            const varName = `--${prefix}-${key}`;
            generatedVars[varName] = generateClamp(
              min,
              max,
              config.minWidth,
              config.maxWidth
            );
          });

          for (let i = 0; i < keys.length; i++) {
            for (let j = i + 1; j < keys.length; j++) {
              const key1 = keys[i];
              const key2 = keys[j];
              const [min1] = values[key1];
              const [, max2] = values[key2];
              const pairVarName = `--${prefix}-${key1}-${key2}`;
              generatedVars[pairVarName] = generateClamp(
                min1,
                max2,
                config.minWidth,
                config.maxWidth
              );
            }
          }
        });

        atRule.replaceWith({
          selector: ":root",
          nodes: Object.entries(generatedVars).map(([key, value]) => ({
            prop: key,
            value,
          })),
        });
      },
    },
  };
};

module.exports.postcss = true;

function generateClamp(minValue, maxValue, minWidth, maxWidth) {
  const slope = (maxValue - minValue) / (maxWidth - minWidth);
  const intercept = minValue - slope * minWidth;
  return `clamp(${minValue}px, ${intercept.toFixed(2)}px + ${(
    slope * 100
  ).toFixed(2)}vw, ${maxValue}px)`;
}
