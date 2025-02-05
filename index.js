const CSSValueParser = require("postcss-value-parser");
// const { calculateSpaceScale, calculateTypeScale } = require("utopia-core");

/**
 * @type {import('postcss').PluginCreator}
 */
module.exports = (opts) => {
  const DEFAULTS = {
    minWidth: 320,
    maxWidth: 1240,
    minFontSize: 16,
    maxFontSize: 20,
  };
  const config = Object.assign(DEFAULTS, opts);

  // const typeScale = (atRule, result) => {
  //   const { nodes } = CSSValueParser(atRule.params);
  //   const params = nodes[0].nodes.filter(
  //     (x) =>
  //       ["word", "string"].includes(x.type) &&
  //       x.value !== "{" &&
  //       x.value !== "}"
  //   );

  //   const typeParams = {
  //     minWidth: config.minWidth,
  //     maxWidth: config.maxWidth,
  //     minFontSize: 16,
  //     maxFontSize: 16,
  //     minTypeScale: 1.1,
  //     maxTypeScale: 1.1,
  //     positiveSteps: 0,
  //     negativeSteps: 0,
  //     relativeTo: "viewport",
  //     prefix: "step",
  //   };
  //   const paramKeys = Object.keys(typeParams);

  //   if (!params.length) {
  //     atRule.remove();
  //     return false;
  //   }

  //   for (let index = 0; index < params.length; index = index + 2) {
  //     const element = params[index];
  //     const key = element.value;
  //     const value = params[index + 1];
  //     if (!key || value === undefined) continue;

  //     if (paramKeys.includes(key)) {
  //       typeParams[key] = isNaN(typeParams[key])
  //         ? value.value
  //         : Number(value.value);
  //     }
  //   }

  //   const typeScale = calculateTypeScale(typeParams);
  //   const response = `${typeScale
  //     .map((step) => {
  //       return `--${typeParams.prefix || "step"}-${step.step}: ${step.clamp};`;
  //     })
  //     .join("\n")}`;

  //   typeScale.some((step) => {
  //     if (step.wcagViolation) {
  //       atRule.warn(
  //         result,
  //         `WCAG SC 1.4.4 violation for viewports ${step.wcagViolation.from}px to ${step.wcagViolation.to}px.`
  //       );
  //       return true;
  //     }
  //     return false;
  //   });

  //   atRule.replaceWith(response);

  //   return false;
  // };

  // const spaceScale = (atRule) => {
  //   const { nodes } = CSSValueParser(atRule.params);
  //   const params = nodes[0].nodes.filter(
  //     (x) =>
  //       ["word", "string"].includes(x.type) &&
  //       x.value !== "{" &&
  //       x.value !== "}"
  //   );

  //   if (!params.length) {
  //     atRule.remove();
  //     return false;
  //   }

  //   const spaceParams = {
  //     minWidth: config.minWidth,
  //     maxWidth: config.maxWidth,
  //     minSize: 16,
  //     maxSize: 16,
  //     positiveSteps: [],
  //     negativeSteps: [],
  //     customSizes: [],
  //     relativeTo: "viewport",
  //     usePx: false,
  //     prefix: "space",
  //   };
  //   const paramKeys = Object.keys(spaceParams);
  //   const arrayParams = ["positiveSteps", "negativeSteps", "customSizes"];
  //   const keyParams = paramKeys.filter((x) => !arrayParams.includes(x));

  //   keyParams.forEach((param) => {
  //     const index = params.findIndex((x) => x.value === param);
  //     if (index !== -1 && params[index + 1] !== undefined) {
  //       if (["minWidth", "maxWidth", "minSize", "maxSize"].includes(param)) {
  //         spaceParams[param] = Number(params[index + 1].value);
  //       } else if ("usePx" === param) {
  //         spaceParams[param] = params[index + 1].value === "true";
  //       } else {
  //         spaceParams[param] = params[index + 1].value;
  //       }

  //       params.splice(index, 2);
  //     }
  //   });

  //   const remainingParams = params
  //     .map((x) => x.value.replace("[", "").replace("]", ""))
  //     .filter((x) => x !== "");
  //   let runningKey = "";
  //   remainingParams.forEach((val) => {
  //     if (arrayParams.includes(val)) {
  //       runningKey = val;
  //     } else {
  //       spaceParams[runningKey].push(
  //         runningKey === "customSizes" ? val : Number(val)
  //       );
  //     }
  //   });

  //   const spaceScale = calculateSpaceScale(spaceParams);

  //   const response = `${[
  //     ...spaceScale.sizes,
  //     ...spaceScale.oneUpPairs,
  //     ...spaceScale.customPairs,
  //   ]
  //     .map((step) => {
  //       return `--${spaceParams.prefix || "space"}-${step.label}: ${
  //         spaceParams.usePx ? step.clampPx : step.clamp
  //       };`;
  //     })
  //     .join("\n")}`;

  //   atRule.replaceWith(response);

  //   return false;
  // };

  const calculateClamp = ({ minSize, maxSize, minWidth, maxWidth }) => {
    // Calculate the slope of the linear interpolation
    const slope = (maxSize - minSize) / (maxWidth - minWidth);
    // Calculate the intersection with the y-axis (b in y = mx + b)
    const intersect = -minWidth * slope + minSize;

    return `clamp(${minSize}px, ${
      slope * 100
    }vw + ${intersect}px, ${maxSize}px)`;
  };

  const generateClamps = ({ pairs, minWidth, maxWidth, prefix, usePx }) => {
    return pairs.map(({ name, values: [minSize, maxSize] }) => ({
      label: name,
      clamp: calculateClamp({ minSize, maxSize, minWidth, maxWidth }),
      clampPx: `${minSize}px`, // Fallback for when usePx is true
    }));
  };

  const clamps = (atRule) => {
    console.log("Starting clamps function with params:", atRule.params);

    const { nodes } = CSSValueParser(atRule.params);
    console.log("Parsed nodes:", nodes);

    const params = nodes[0].nodes.filter(
      (x) =>
        ["word", "string"].includes(x.type) &&
        x.value !== "{" &&
        x.value !== "}"
    );
    console.log("Filtered params:", params);

    const clampsParams = {
      minWidth: config.minWidth,
      maxWidth: config.maxWidth,
      pairs: {},
      relativeTo: "viewport",
      prefix: "space",
      usePx: false,
    };

    // First pass: handle all basic parameters
    for (let i = 0; i < params.length; i++) {
      const param = params[i];
      const nextParam = params[i + 1];

      if (!param || !nextParam) continue;

      const key = param.value;
      let value = nextParam.value;

      // Clean up the value - remove any colons or commas
      if (typeof value === "string") {
        value = value.replace(":", "").replace(",", "");
      }

      switch (key) {
        case "minWidth":
        case "maxWidth":
          clampsParams[key] = Number(value);
          i++; // Skip the next param since we used it
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
      }
    }

    console.log("Parameters after first pass:", clampsParams);

    // Second pass: handle pairs
    const pairsStartIndex = params.findIndex((x) => x.value === "pairs");
    if (pairsStartIndex !== -1) {
      let currentName = null;
      let currentValues = [];

      for (let i = pairsStartIndex + 1; i < params.length; i++) {
        const param = params[i];
        const value = param.value.replace("[", "").replace("]", "");

        // Skip empty values and brackets
        if (!value || value === "[" || value === "]") continue;

        if (param.type === "string") {
          // This is a name
          if (currentName && currentValues.length === 2) {
            clampsParams.pairs[currentName] = currentValues;
          }
          currentName = value;
          currentValues = [];
        } else {
          // This is a number
          const numValue = Number(value);
          if (!isNaN(numValue)) {
            currentValues.push(numValue);
          }
        }

        // If we have a complete pair, add it
        if (currentName && currentValues.length === 2) {
          clampsParams.pairs[currentName] = currentValues;
        }
      }
    }

    console.log("Final params:", clampsParams);

    // Convert the pairs to the format expected by calculateClamps
    const clampPairs = Object.entries(clampsParams.pairs).map(
      ([name, values]) => ({
        name,
        values,
      })
    );

    console.log("Clamp pairs:", clampPairs);

    const clampScale = generateClamps({
      ...clampsParams,
      pairs: clampPairs,
    });

    const response = `${clampScale
      .map((step) => {
        return `--${clampsParams.prefix}-${step.label}: ${
          clampsParams.usePx ? step.clampPx : step.clamp
        };`;
      })
      .join("\n")}`;

    atRule.replaceWith(response);

    return false;
  };

  // const clamps = (atRule) => {
  //   const { nodes } = CSSValueParser(atRule.params);
  //   const params = nodes[0].nodes.filter(x => ['word', 'string'].includes(x.type) && x.value !== '{' && x.value !== '}');

  //   if (!params.length) {
  //     atRule.remove();
  //     return false;
  //   }

  //   const clampsParams = {
  //     minWidth: config.minWidth,
  //     maxWidth: config.maxWidth,
  //     pairs: [],
  //     relativeTo: 'viewport',
  //     prefix: 'space',
  //     usePx: false
  //   };
  //   const paramKeys = Object.keys(clampsParams);
  //   const arrayParams = ['pairs'];
  //   const keyParams = paramKeys.filter(x => !arrayParams.includes(x));

  //   keyParams.forEach(param => {
  //     const index = params.findIndex(x => x.value === param);
  //     if (index !== -1 && params[index + 1] !== undefined) {
  //       if (['minWidth', 'maxWidth'].includes(param)) {
  //         clampsParams[param] = Number(params[index + 1].value);
  //       } else if ('usePx' === param) {
  //         clampsParams[param] = params[index + 1].value === 'true';
  //       } else {
  //         clampsParams[param] = params[index + 1].value;
  //       }

  //       params.splice(index, 2);
  //     }
  //   });

  //   const remainingParams = params.map(x => x.value.replaceAll('[', '').replaceAll(']', '')).filter(x => x !== '');
  //   let runningKey = '';
  //   remainingParams.forEach(val => {
  //     if (arrayParams.includes(val)) {
  //       runningKey = val;
  //     } else {
  //       clampsParams[runningKey].push(Number(val));
  //     }
  //   });

  //   clampsParams.pairs = clampsParams.pairs.reduce(function (pairs, value, index, array) {
  //     if (index % 2 === 0)
  //     pairs.push(array.slice(index, index + 2));
  //     return pairs;
  //   }, []);

  //   const clampScale = calculateClamps(clampsParams);
  //   const response = `${clampScale.map(step => {
  //     return `--${clampsParams.prefix || 'space'}-${step.label}: ${clampsParams.usePx ? step.clampPx : step.clamp};`
  //   }).join('\n')}`;

  //   atRule.replaceWith(response);

  //   return false;
  // }

  return {
    postcssPlugin: "hc-fluid-variables",

    AtRule: {
      utopia: (atRule, { result }) => {
        // if (atRule.params.startsWith("typeScale(")) {
        //   return typeScale(atRule, result);
        // }

        // if (atRule.params.startsWith("spaceScale(")) {
        //   return spaceScale(atRule);
        // }

        if (atRule.params.startsWith("clamps(")) {
          return clamps(atRule);
        }
      },
    },

    Declaration(decl) {
      // The faster way to find Declaration node
      const parsedValue = CSSValueParser(decl.value);

      let valueChanged = false;
      parsedValue.walk((node) => {
        if (node.type !== "function" || node.value !== "utopia.clamp") {
          return;
        }

        let [minSize, maxSize, minWidth, maxWidth] = node.nodes
          .filter((x) => x.type === "word")
          .map((x) => x.value)
          .map(Number);
        if (!minWidth) minWidth = config.minWidth;
        if (!maxWidth) maxWidth = config.maxWidth;

        if (!minSize || !maxSize || !minWidth || !maxWidth) return false;

        // Generate clamp
        const clamp = calculateClamp({ minSize, maxSize, minWidth, maxWidth });

        // Convert back PostCSS nodes
        const {
          nodes: [{ nodes }],
        } = CSSValueParser(clamp);

        node.value = "clamp";
        node.nodes = nodes;
        valueChanged = true;

        return false;
      });

      if (valueChanged) {
        decl.value = CSSValueParser.stringify(parsedValue);
      }
    },
  };
};

module.exports.postcss = true;
