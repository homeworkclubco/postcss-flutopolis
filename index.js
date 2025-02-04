/**
 * @type {import('postcss').PluginCreator}
 */
module.exports = (opts = {}) => {
  return {
    postcssPlugin: "postcss-hc-fluid-variables",
    Root(root) {
      const { minWidth = 320, maxWidth = 1240, scales = {} } = opts;

      const generatedVars = {};

      Object.entries(scales).forEach(([prefix, values]) => {
        Object.keys(values).forEach((key) => {
          const [min, max] = values[key];
          const varName = `--${prefix}-${key}`;
          generatedVars[varName] = generateClamp(min, max, minWidth, maxWidth);
        });
      });

      root.walkDecls((decl) => {
        const match = decl.value.match(/var\((--[^)]+)-([^),]+)\)/);
        if (match) {
          const [, baseVar, targetKey] = match;
          if (
            generatedVars[baseVar] &&
            generatedVars[`--${baseVar.split("--")[1]}-${targetKey}`]
          ) {
            const min = parseFloat(
              generatedVars[baseVar].match(/clamp\(([^px]+)/)[1]
            );
            const max = parseFloat(
              generatedVars[`--${baseVar.split("--")[1]}-${targetKey}`].match(
                /, ([^px]+)/
              )[1]
            );
            const newVar = `--${baseVar.split("--")[1]}-${targetKey}`;
            generatedVars[newVar] = generateClamp(min, max, minWidth, maxWidth);
          }
        }
      });

      root.append({
        selector: ":root",
        nodes: Object.entries(generatedVars).map(([key, value]) => ({
          prop: key,
          value,
        })),
      });
    },
  };
};

module.exports.postcss = true;

/**
 * Generate a CSS clamp function that interpolates between min and max values
 * @param {number} minValue - Minimum value
 * @param {number} maxValue - Maximum value
 * @param {number} minWidth - Minimum viewport width
 * @param {number} maxWidth - Maximum viewport width
 * @returns {string} - clamp() function
 */
function generateClamp(minValue, maxValue, minWidth, maxWidth) {
  const slope = (maxValue - minValue) / (maxWidth - minWidth);
  const intercept = minValue - slope * minWidth;
  return `clamp(${minValue}px, ${intercept.toFixed(2)}px + ${(
    slope * 100
  ).toFixed(2)}vw, ${maxValue}px)`;
}
