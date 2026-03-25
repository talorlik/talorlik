(function () {
  'use strict';

  var CANONICAL_BASE = 'https://talorlik.github.io/talorlik';

  function getMetaDescription() {
    var el = document.querySelector('meta[name="description"]');
    if (el && el.getAttribute('content')) {
      return el.getAttribute('content').trim();
    }
    return '';
  }

  function injectJsonLd() {
    var description = getMetaDescription();
    var graph = [
      {
        '@type': 'WebSite',
        '@id': CANONICAL_BASE + '/#website',
        name: 'Tal Orlik',
        url: CANONICAL_BASE + '/',
        description: description,
        inLanguage: 'en',
        publisher: { '@id': CANONICAL_BASE + '/#person' },
      },
      {
        '@type': 'WebPage',
        '@id': CANONICAL_BASE + '/#webpage',
        url: CANONICAL_BASE + '/',
        name: 'Tal Orlik | DevOps Engineer & Cloud Architect',
        description: description,
        inLanguage: 'en',
        isPartOf: { '@id': CANONICAL_BASE + '/#website' },
        about: { '@id': CANONICAL_BASE + '/#person' },
        mainEntity: { '@id': CANONICAL_BASE + '/#person' },
      },
      {
        '@type': 'Person',
        '@id': CANONICAL_BASE + '/#person',
        name: 'Tal Orlik',
        jobTitle: 'DevOps Engineer',
        description: description,
        url: CANONICAL_BASE + '/',
        email: 'talorlik@gmail.com',
        telephone: '+972-53-852-0014',
        sameAs: [
          'https://www.linkedin.com/in/talorlik',
          'https://github.com/talorlik',
        ],
        knowsAbout: [
          'DevOps',
          'Cloud architecture',
          'Kubernetes',
          'AWS',
          'Terraform',
          'Platform engineering',
          'CI/CD',
        ],
      },
    ];

    var payload = {
      '@context': 'https://schema.org',
      '@graph': graph,
    };

    var el = document.createElement('script');
    el.type = 'application/ld+json';
    el.textContent = JSON.stringify(payload);
    document.head.appendChild(el);
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.documentElement.classList.add('js');
    injectJsonLd();
  });
})();
