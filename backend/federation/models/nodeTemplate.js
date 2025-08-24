const defaultNodeTemplate = {
  nodeId: '',
  production: {
    capabilities: []
  },
  services: {
    educational: [],
    socialMedia: [],
    extension: [],
    financial: {
      marketListings: [],
      grants: []
    },
    marketing: {
      onNetwork: [],
      socialMediaSyndication: []
    },
    messaging: {
      enabled: false,
      levesonRatings: []
    }
  },
  reputation: {
    leveson: 0
  },
  interoperability: [],
  support: {
    compostingGrazing: [],
    environmentalServices: [],
    labor: [],
    collectiveManagement: []
  }
};

function mergeRecursively(template, target = {}) {
  const result = Array.isArray(target) ? target.slice() : { ...target };
  for (const key of Object.keys(template)) {
    const templateValue = template[key];
    const targetValue = target[key];
    if (
      templateValue &&
      typeof templateValue === 'object' &&
      !Array.isArray(templateValue)
    ) {
      result[key] = mergeRecursively(templateValue, targetValue || {});
    } else if (targetValue === undefined) {
      result[key] = templateValue;
    } else {
      result[key] = targetValue;
    }
  }
  return result;
}

function applyNodeTemplate(node) {
  return mergeRecursively(defaultNodeTemplate, node);
}

module.exports = { defaultNodeTemplate, applyNodeTemplate };
