const knowledgeBase = require('../backend/kb.json');

module.exports = function getKnowledgeBase(_request, response) {
  response.setHeader('Cache-Control', 'public, max-age=300');
  response.status(200).json(knowledgeBase);
};
