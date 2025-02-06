const CSSValueParser = require("postcss-value-parser");

/**
 * @type {import('postcss').PluginCreator}
 */
module.exports = (opts) => {
  const DEFAULTS = {
    minWidth: 320,
    maxWidth: 1240,
    generateAllCrossPairs: false,
    usePx: false,
  };
  const config = Object.assign(DEFAULTS, opts);

  const pxToRem = (px) => `${parseFloat((px / 16).toFixed(4))}rem`;

  const calculateClamp = ({ minSize, maxSize, minWidth, maxWidth, usePx }) => {
    const slope = (maxSize - minSize) / (maxWidth - minWidth);
    const intersect = -minWidth * slope + minSize;
    // const unit = usePx ? "px" : "rem";
    return `clamp(${usePx ? minSize + "px" : pxToRem(minSize)}, ${(
      slope * 100
    ).toFixed(4)}vw + ${usePx ? intersect + "px" : pxToRem(intersect)}, ${
      usePx ? maxSize + "px" : pxToRem(maxSize)
    })`;
  };

  const generateClamps = ({
    pairs,
    minWidth,
    maxWidth,
    prefix,
    usePx,
    generateAllCrossPairs,
  }) => {
    let clampScales = pairs.map(({ name, values: [minSize, maxSize] }) => ({
      label: name,
      clamp: calculateClamp({ minSize, maxSize, minWidth, maxWidth, usePx }),
      clampPx: `${minSize}px`,
    }));

    if (generateAllCrossPairs) {
      let crossPairs = [];
      for (let i = 0; i < pairs.length; i++) {
        for (let j = i + 1; j < pairs.length; j++) {
          const [smaller, larger] = [pairs[i], pairs[j]].sort(
            (a, b) => a.values[0] - b.values[0]
          );
          crossPairs.push({
            label: `${smaller.name}-${larger.name}`,
            clamp: calculateClamp({
              minSize: smaller.values[0],
              maxSize: larger.values[1],
              minWidth,
              maxWidth,
              usePx,
            }),
            clampPx: `${smaller.values[0]}px`,
          });
        }
      }
      clampScales = [...clampScales, ...crossPairs];
    }

    return clampScales;
  };

  const clamps = (atRule) => {
    const { nodes } = CSSValueParser(atRule.params);
    const params = nodes[0].nodes.filter(
      (x) =>
        ["word", "string"].includes(x.type) &&
        x.value !== "{" &&
        x.value !== "}"
    );

    const clampsParams = {
      minWidth: config.minWidth,
      maxWidth: config.maxWidth,
      pairs: {},
      relativeTo: "viewport",
      prefix: "space",
      usePx: config.usePx,
      generateAllCrossPairs: config.generateAllCrossPairs,
    };

    for (let i = 0; i < params.length; i++) {
      const param = params[i];
      const nextParam = params[i + 1];
      if (!param || !nextParam) continue;
      const key = param.value;
      let value = nextParam.value.replace(/[:,]/g, "");

      switch (key) {
        case "minWidth":
        case "maxWidth":
          clampsParams[key] = Number(value);
          i++;
          break;
        case "usePx":
          clampsParams.usePx = value === "true";
          i++;
          break;
        case "prefix":
          clampsParams.prefix = value.replace(/['"]/g, "");
          i++;
          break;
        case "relativeTo":
          clampsParams.relativeTo = value.replace(/['"]/g, "");
          i++;
          break;
        case "generateAllCrossPairs":
          clampsParams.generateAllCrossPairs = value === "true";
          i++;
          break;
      }
    }

    const pairsStartIndex = params.findIndex((x) => x.value === "pairs");
    if (pairsStartIndex !== -1) {
      let currentName = null;
      let currentValues = [];

      for (let i = pairsStartIndex + 1; i < params.length; i++) {
        const param = params[i];
        const value = param.value.replace("[", "").replace("]", "");
        if (!value || value === "[" || value === "]") continue;
        if (param.type === "string") {
          if (currentName && currentValues.length === 2) {
            clampsParams.pairs[currentName] = currentValues;
          }
          currentName = value;
          currentValues = [];
        } else {
          const numValue = Number(value);
          if (!isNaN(numValue)) currentValues.push(numValue);
        }
        if (currentName && currentValues.length === 2) {
          clampsParams.pairs[currentName] = currentValues;
        }
      }
    }

    const clampPairs = Object.entries(clampsParams.pairs).map(
      ([name, values]) => ({ name, values })
    );
    const clampScale = generateClamps({ ...clampsParams, pairs: clampPairs });

    const response = `${clampScale
      .map(
        (step) =>
          `--${clampsParams.prefix}-${step.label}: ${
            clampsParams.usePx ? step.clampPx : step.clamp
          };`
      )
      .join("\n")}`;

    atRule.replaceWith(response);
    return false;
  };

  return {
    postcssPlugin: "flutopolis",
    AtRule: {
      flutopolis: (atRule) => {
        if (atRule.params.startsWith("clamps(")) {
          return clamps(atRule);
        }
      },
    },
    Declaration(decl) {
      const parsedValue = CSSValueParser(decl.value);
      parsedValue.walk((node) => {
        // if (node.type !== "function" || node.value !== "kurt.clamp") return;
        if (node.type !== "function") return;
        let [minSize, maxSize, minWidth, maxWidth] = node.nodes
          .filter((x) => x.type === "word")
          .map((x) => Number(x.value));
        minWidth = minWidth || config.minWidth;
        maxWidth = maxWidth || config.maxWidth;
        if (!minSize || !maxSize) return;
        node.value = "clamp";
        node.nodes = CSSValueParser(
          calculateClamp({
            minSize,
            maxSize,
            minWidth,
            maxWidth,
            usePx: config.usePx,
          })
        ).nodes;
      });
      decl.value = CSSValueParser.stringify(parsedValue);
    },
  };
};

module.exports.postcss = true;
