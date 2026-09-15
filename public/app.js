// Interface V1 - vanilla JS, aucun framework. Toute la logique metier vit
// cote serveur (src/server/api.js) qui reutilise les moteurs existants ;
// ce fichier ne fait qu'afficher les donnees et les signaux du catalogue
// existant (config/signals.json), jamais une liste parallele.

const app = document.getElementById('app');
let CONFIG = null;

// Titres d'affichage des categories de signaux. Ce sont uniquement des
// intitules de section pour l'UI : les signaux eux-memes viennent tous de
// /api/config (config/signals.json), jamais codes en dur ici.
const CATEGORY_TITLES = {
  fit: 'FIT',
  maturite: 'MATURITE',
  probleme: 'PROBLEME',
  intention: 'INTENTION',
  contexte: 'CONTEXTE (aide a identifier une offre LIBERTE)',
  exclusion: 'EXCLUSION — si coche, le prospect sera IGNORE'
};

const TEMPERATURE_BADGE = {
  HOT: '<span class="badge badge-hot">🔥 HOT</span>',
  WARM: '<span class="badge badge-warm">🟠 WARM</span>',
  COLD: '<span class="badge badge-cold">🔵 COLD</span>',
  IGNORE: '<span class="badge badge-ignore">❌ IGNORE</span>'
};

const ACTION_BADGE = {
  CONVERSATION: '<span class="badge badge-hot">🔥 CONVERSATION</span>',
  WARM_UP: '<span class="badge badge-warm">🟠 WARM-UP</span>',
  NURTURE: '<span class="badge badge-cold">🔵 NURTURE</span>',
  IGNORE: '<span class="badge badge-ignore">❌ IGNORE</span>'
};

const OFFER_LABELS = {
  VISIBILITE: 'VISIBILITE',
  SERENITE: 'SERENITE',
  LIBERTE: 'LIBERTE',
  NON_IDENTIFIE: 'AUCUNE (non identifiee)'
};

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

async function apiGet(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Erreur ${res.status}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

async function ensureConfig() {
  if (!CONFIG) CONFIG = await apiGet('/api/config');
  return CONFIG;
}

// ---------- Router ----------

async function router() {
  const hash = window.location.hash || '#/nouveau';
  const [, route, param] = hash.match(/^#\/(\w+)(?:\/(.+))?$/) || [null, 'nouveau'];

  document.querySelectorAll('.nav-link').forEach((el) => {
    el.classList.toggle('active', el.dataset.route === route);
  });

  try {
    await ensureConfig();
    if (route === 'nouveau') return renderNouveau();
    if (route === 'extraction') return renderExtraction();
    if (route === 'pipeline') return renderPipeline();
    if (route === 'top') return renderTop();
    if (route === 'prospect' && param) return renderFiche(decodeURIComponent(param));
    return renderNouveau();
  } catch (err) {
    app.innerHTML = `<div class="card"><p class="status-msg error">Erreur de chargement : ${escapeHtml(err.message)}</p></div>`;
  }
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);

// ---------- Vue : Nouveau prospect ----------

function renderSignalGroup(category) {
  const keys = CONFIG.signals.categories[category] || [];
  const labels = CONFIG.signals.labels || {};
  const isExclusion = category === 'exclusion';
  const rows = keys
    .map(
      (key) => `
      <label class="checkbox-row">
        <input type="checkbox" name="signal" value="${category}.${key}" />
        <span>${escapeHtml(labels[key] || key)}</span>
      </label>`
    )
    .join('');

  return `
    <fieldset>
      <legend class="${isExclusion ? 'legend-exclusion' : ''}">${escapeHtml(CATEGORY_TITLES[category] || category)}</legend>
      <div class="checkbox-grid">${rows}</div>
    </fieldset>`;
}

function renderNouveau() {
  const categories = ['fit', 'maturite', 'probleme', 'intention', 'contexte', 'exclusion'];

  app.innerHTML = `
    <h1>Nouveau prospect</h1>
    <p class="page-subtitle">Renseignez ce que vous savez, cochez les signaux observes, puis lancez l'analyse.</p>

    <form id="prospect-form">
      <div class="card">
        <h2>Informations</h2>
        <div class="grid-2">
          <div class="field"><label>Prenom</label><input type="text" name="prenom" /></div>
          <div class="field"><label>Nom</label><input type="text" name="nom" /></div>
          <div class="field"><label>Entreprise</label><input type="text" name="entreprise" /></div>
          <div class="field"><label>Pays</label><input type="text" name="pays" placeholder="France, Belgique, Suisse..." /></div>
          <div class="field"><label>URL LinkedIn</label><input type="url" name="url_linkedin" placeholder="https://www.linkedin.com/in/..." /></div>
          <div class="field"><label>Type de prospect</label><input type="text" name="type_prospect" placeholder="Coach business, formateur..." /></div>
          <div class="field"><label>Offre (la sienne)</label><input type="text" name="offre" placeholder="Ce que le prospect vend" /></div>
          <div class="field"><label>Audience</label><input type="text" name="audience" placeholder="Taille / plateforme principale" /></div>
        </div>
        <div class="field"><label>Activite</label><input type="text" name="activite" placeholder="Description courte de l'activite" /></div>
        <div class="field"><label>Description libre</label><textarea name="notes" placeholder="Notes libres sur ce prospect"></textarea></div>
      </div>

      <div class="card">
        <h2>Signaux observes</h2>
        <p class="hint">Cochez uniquement les signaux que vous avez reellement observes (catalogue officiel du projet, config/signals.json).</p>
        ${categories.map(renderSignalGroup).join('')}
      </div>

      <div class="card">
        <h2>Faits vs hypotheses</h2>
        <div class="field">
          <label>Faits observes</label>
          <textarea name="faits_observes" placeholder="Un fait observable par ligne. Ex : 'Publie 2 fois par semaine sur LinkedIn'"></textarea>
        </div>
        <div class="warning-box">⚠️ Ne pas presenter une hypothese comme un fait.</div>
        <div class="field">
          <label>Hypotheses</label>
          <textarea name="hypotheses" placeholder="Une hypothese par ligne. Ex : 'Pourrait manquer de temps pour communiquer'"></textarea>
        </div>
        <div class="field">
          <label>Sources</label>
          <textarea name="sources" placeholder="Une source par ligne (profil LinkedIn, post, echange, etc.)"></textarea>
        </div>
      </div>

      <button type="submit" class="btn">🔎 Analyser le prospect</button>
      <span id="form-status" class="status-msg"></span>
    </form>

    <div id="result-container"></div>
  `;

  document.getElementById('prospect-form').addEventListener('submit', onSubmitProspect);
}

function collectSignals(form) {
  const signals = { fit: {}, maturite: {}, probleme: {}, intention: {}, contexte: {}, exclusion: {} };
  form.querySelectorAll('input[name="signal"]:checked').forEach((input) => {
    const [category, key] = input.value.split('.');
    signals[category][key] = true;
  });
  return signals;
}

function linesToArray(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

async function onSubmitProspect(event) {
  event.preventDefault();
  const form = event.target;
  const statusEl = document.getElementById('form-status');
  statusEl.textContent = 'Analyse en cours...';
  statusEl.className = 'status-msg';

  const formData = new FormData(form);
  const payload = {
    prenom: formData.get('prenom')?.trim() || '',
    nom: formData.get('nom')?.trim() || '',
    entreprise: formData.get('entreprise')?.trim() || '',
    pays: formData.get('pays')?.trim() || undefined,
    url_linkedin: formData.get('url_linkedin')?.trim() || '',
    type_prospect: formData.get('type_prospect')?.trim() || undefined,
    offre: formData.get('offre')?.trim() || undefined,
    audience: formData.get('audience')?.trim() || undefined,
    activite: formData.get('activite')?.trim() || undefined,
    notes: formData.get('notes')?.trim() || '',
    faits_observes: linesToArray(formData.get('faits_observes')),
    hypotheses: linesToArray(formData.get('hypotheses')),
    sources: linesToArray(formData.get('sources')),
    signals: collectSignals(form)
  };

  try {
    const result = await apiPost('/api/analyze', payload);
    statusEl.textContent = result.isDuplicate
      ? `Doublon detecte (${result.matchedOn}) — fiche existante mise a jour.`
      : 'Prospect analyse avec succes.';
    statusEl.className = 'status-msg ok';
    document.getElementById('result-container').innerHTML = renderResultCard(result.prospect);
    document.getElementById('result-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    statusEl.textContent = `Erreur : ${err.message}`;
    statusEl.className = 'status-msg error';
  }
}

// ---------- Rendu du resultat d'analyse (reutilise en fiche prospect) ----------

function renderResultCard(p) {
  const scoring = CONFIG.scoring.categories;
  const isIgnored = p.temperature === 'IGNORE';

  const scoreBlock = isIgnored
    ? `<div class="callout exclusion">
        <strong>❌ Prospect exclu — aucun score calcule (pour ne pas inventer une qualification).</strong>
        <div class="pill-list">${(p.raisons_exclusion || []).map((r) => `<span class="pill">${escapeHtml(r.label)}</span>`).join('')}</div>
      </div>`
    : `
      <div class="score-grid">
        <div class="score-tile"><div class="label">FIT</div><div class="value">${p.score_fit}/${scoring.fit.max_points}</div></div>
        <div class="score-tile"><div class="label">MATURITE</div><div class="value">${p.score_maturite}/${scoring.maturite.max_points}</div></div>
        <div class="score-tile"><div class="label">PROBLEME</div><div class="value">${p.score_probleme}/${scoring.probleme.max_points}</div></div>
        <div class="score-tile"><div class="label">INTENTION</div><div class="value">${p.score_intention}/${scoring.intention.max_points}</div></div>
      </div>
      <div class="score-total">
        <div class="value">${p.score_total}/100</div>
        <div class="label">SCORE TOTAL</div>
      </div>`;

  const intentionBlock =
    p.temperature === 'HOT' && (p.signaux_intention_detectes || []).length
      ? `<div class="callout"><strong>Signal(aux) d'intention justifiant le HOT :</strong>
          <div class="pill-list">${p.signaux_intention_detectes.map((s) => `<span class="pill">${escapeHtml(s.label)}</span>`).join('')}</div>
        </div>`
      : '';

  const besoinBlock = isIgnored
    ? ''
    : `
    <hr class="divider" />
    <div class="section-title">Besoin detecte</div>
    <div class="kv"><div class="k">Probleme principal</div><div class="v">${escapeHtml(p.probleme_principal || 'Non identifie')}</div></div>
    <div class="kv"><div class="k">Problemes secondaires</div><div class="v">${
      (p.problemes_secondaires || []).length ? p.problemes_secondaires.map(escapeHtml).join(', ') : 'Aucun'
    }</div></div>
    <div class="kv"><div class="k">Niveau de confiance</div><div class="v">${escapeHtml(p.niveau_confiance || 'Non determine')}</div></div>
    <div class="kv"><div class="k">Faits observes</div><div class="v">${
      (p.faits_observes || []).length ? p.faits_observes.map(escapeHtml).join('<br/>') : 'Non identifie'
    }</div></div>
    <div class="kv"><div class="k">Hypotheses</div><div class="v">${
      (p.hypotheses || []).length ? p.hypotheses.map(escapeHtml).join('<br/>') : 'Aucune'
    }</div></div>`;

  const offreBlock = isIgnored
    ? ''
    : `
    <hr class="divider" />
    <div class="section-title">Offre recommandee</div>
    <p style="font-size:16px; font-weight:700; margin:4px 0;">${escapeHtml(OFFER_LABELS[p.offre_recommandee] || p.offre_recommandee)}</p>
    <div class="kv"><div class="k">Pourquoi cette offre ?</div><div class="v">${escapeHtml(p.justification_offre || '')}</div></div>`;

  return `
    <div class="card result-section">
      <div class="result-header">
        <h2>${escapeHtml(p.prenom)} ${escapeHtml(p.nom)}</h2>
        ${TEMPERATURE_BADGE[p.temperature] || ''}
      </div>
      <div class="kv"><div class="k">Activite</div><div class="v">${escapeHtml(p.activite || 'Non identifie')}</div></div>
      <div class="kv"><div class="k">Pays</div><div class="v">${escapeHtml(p.pays || 'Non identifie')}</div></div>

      <hr class="divider" />
      <div class="section-title">Score</div>
      ${scoreBlock}
      ${intentionBlock}
      ${besoinBlock}
      ${offreBlock}

      <hr class="divider" />
      <div class="section-title">Action recommandee</div>
      <p>${ACTION_BADGE[p.action_recommandee] || ''}</p>
      <div class="kv"><div class="k">Pourquoi cette action ?</div><div class="v">${escapeHtml(p.justification_action || p.justification || '')}</div></div>
      <div class="kv"><div class="k">Prochaine action recommandee</div><div class="v">${escapeHtml(p.prochaine_action || 'Non identifie')}</div></div>
    </div>`;
}

// ---------- Vue : Analyser un profil LinkedIn (texte brut -> extraction -> moteur existant) ----------

const CONFIDENCE_LABEL = {
  ELEVE: '<span class="badge badge-hot" style="background:#dcfce7; color:#15803d;">ÉLEVÉ</span>',
  MOYEN: '<span class="badge badge-warm">MOYEN</span>',
  FAIBLE: '<span class="badge badge-ignore">FAIBLE</span>'
};

function renderExtraction() {
  app.innerHTML = `
    <h1>🔍 Analyser un profil LinkedIn</h1>
    <p class="page-subtitle">
      Collez le contenu disponible sur le profil (description, experiences, derniers posts...).
      Le moteur d'extraction detecte les signaux reellement presents dans le texte, puis les
      transmet au meme moteur de qualification/scoring que le formulaire manuel — rien n'est
      invente, et le bareme de scoring n'est jamais modifie par cette fonction.
    </p>

    <form id="extraction-form">
      <div class="card">
        <h2>Informations de base</h2>
        <div class="grid-2">
          <div class="field"><label>Prenom</label><input type="text" name="prenom" /></div>
          <div class="field"><label>Nom</label><input type="text" name="nom" /></div>
          <div class="field"><label>Entreprise</label><input type="text" name="entreprise" /></div>
          <div class="field"><label>Pays</label><input type="text" name="pays" placeholder="France, Belgique, Suisse..." /></div>
        </div>
        <div class="field"><label>URL LinkedIn</label><input type="url" name="url_linkedin" placeholder="https://www.linkedin.com/in/..." /></div>
      </div>

      <div class="card">
        <h2>Contenu brut</h2>
        <div class="field">
          <label>Collez ici les informations disponibles sur le profil LinkedIn</label>
          <textarea name="texte_brut" rows="12" placeholder="Collez ici les informations disponibles sur le profil LinkedIn, la description, les experiences, les derniers posts ou tout autre contenu public pertinent.

Exemple :
Je suis coach business...
J'accompagne...
Depuis 2022...
Je viens de lancer...
Je cherche actuellement...
Je n'ai plus le temps de...
"></textarea>
        </div>
        <div class="warning-box">⚠️ Le moteur n'invente jamais un signal : chaque signal detecte devra etre justifie par une phrase reellement presente dans ce texte (visible ensuite dans "Pourquoi ?").</div>
      </div>

      <button type="submit" class="btn">🔍 Analyser un profil LinkedIn</button>
      <span id="extraction-status" class="status-msg"></span>
    </form>

    <div id="extraction-result-container"></div>
  `;

  document.getElementById('extraction-form').addEventListener('submit', onSubmitExtraction);
}

async function onSubmitExtraction(event) {
  event.preventDefault();
  const form = event.target;
  const statusEl = document.getElementById('extraction-status');
  statusEl.textContent = 'Analyse en cours...';
  statusEl.className = 'status-msg';

  const formData = new FormData(form);
  const payload = {
    prenom: formData.get('prenom')?.trim() || '',
    nom: formData.get('nom')?.trim() || '',
    entreprise: formData.get('entreprise')?.trim() || '',
    pays: formData.get('pays')?.trim() || undefined,
    url_linkedin: formData.get('url_linkedin')?.trim() || '',
    texte_brut: formData.get('texte_brut') || ''
  };

  try {
    const result = await apiPost('/api/analyze-text', payload);
    statusEl.textContent = result.isDuplicate
      ? `Doublon detecte (${result.matchedOn}) — fiche existante mise a jour.`
      : 'Profil analyse avec succes.';
    statusEl.className = 'status-msg ok';
    document.getElementById('extraction-result-container').innerHTML =
      renderResultCard(result.prospect) + renderEvidenceSection(result.extraction);
    document.getElementById('extraction-result-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    statusEl.textContent = `Erreur : ${err.message}`;
    statusEl.className = 'status-msg error';
  }
}

function renderEvidenceSection(extraction) {
  const rows = (extraction.evidences || [])
    .map(
      (e) => `
      <tr>
        <td>${escapeHtml(e.label)}${e.applied ? '' : ' <span class="hint">(hypothese, non retenu)</span>'}</td>
        <td>"${escapeHtml(e.evidence)}"</td>
        <td>${escapeHtml(e.impact)}</td>
      </tr>`
    )
    .join('');

  return `
    <div class="card">
      <div class="result-header">
        <h2>Pourquoi ce resultat ?</h2>
        <span>Confiance globale de l'extraction : ${CONFIDENCE_LABEL[extraction.niveau_confiance_extraction] || ''}</span>
      </div>
      <p class="hint">La confiance ci-dessus decrit la qualite des donnees disponibles dans le texte colle — elle ne modifie jamais le score, calcule uniquement par le bareme existant.</p>
      ${
        rows
          ? `<div style="overflow-x:auto;">
              <table>
                <thead><tr><th>Signal</th><th>Preuve (extraite du texte)</th><th>Impact</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>`
          : `<div class="empty-state">Aucun signal detecte dans le texte fourni — rien n'a ete invente. Completez le texte ou les signaux manuellement dans "Nouveau prospect".</div>`
      }
    </div>`;
}

// ---------- Vue : Pipeline ----------

const TEMPERATURE_ORDER = { HOT: 0, WARM: 1, COLD: 2, IGNORE: 3 };

function sortProspects(prospects, sortBy) {
  const list = [...prospects];
  if (sortBy === 'score') {
    list.sort((a, b) => (b.score_total ?? -1) - (a.score_total ?? -1));
  } else if (sortBy === 'temperature') {
    list.sort((a, b) => (TEMPERATURE_ORDER[a.temperature] ?? 9) - (TEMPERATURE_ORDER[b.temperature] ?? 9));
  } else if (sortBy === 'date') {
    list.sort((a, b) => new Date(b.derniere_analyse || b.date_decouverte || 0) - new Date(a.derniere_analyse || a.date_decouverte || 0));
  }
  return list;
}

async function renderPipeline() {
  app.innerHTML = `<h1>Pipeline</h1><p class="page-subtitle">Chargement...</p>`;
  const prospects = await apiGet('/api/prospects');
  renderPipelineTable(prospects, 'score');
}

function renderPipelineTable(prospects, sortBy) {
  const sorted = sortProspects(prospects, sortBy);

  const rows = sorted
    .map(
      (p) => `
      <tr data-id="${escapeHtml(p.id)}">
        <td>${escapeHtml(p.prenom)} ${escapeHtml(p.nom)}</td>
        <td>${escapeHtml(p.entreprise || '—')}</td>
        <td>${p.score_total ?? '—'}</td>
        <td>${TEMPERATURE_BADGE[p.temperature] || '—'}</td>
        <td>${escapeHtml(OFFER_LABELS[p.offre_recommandee] || p.offre_recommandee || '—')}</td>
        <td>${ACTION_BADGE[p.action_recommandee] || '—'}</td>
        <td>${escapeHtml(p.statut_pipeline || '—')}</td>
        <td>${formatDate(p.derniere_analyse)}</td>
        <td>${escapeHtml(p.prochaine_action || '—')}</td>
      </tr>`
    )
    .join('');

  app.innerHTML = `
    <h1>Pipeline</h1>
    <p class="page-subtitle">${prospects.length} prospect(s). Cliquez sur une ligne pour ouvrir la fiche.</p>
    <div class="card">
      <div class="toolbar">
        <h2 style="margin:0;">Tous les prospects</h2>
        <select id="sort-select">
          <option value="score" ${sortBy === 'score' ? 'selected' : ''}>Trier par score decroissant</option>
          <option value="temperature" ${sortBy === 'temperature' ? 'selected' : ''}>Trier par temperature (HOT en premier)</option>
          <option value="date" ${sortBy === 'date' ? 'selected' : ''}>Trier par derniere analyse</option>
        </select>
      </div>
      ${
        prospects.length === 0
          ? `<div class="empty-state">Aucun prospect pour le moment. Commencez par en ajouter un.</div>`
          : `<div style="overflow-x:auto;">
              <table>
                <thead><tr>
                  <th>Nom</th><th>Entreprise</th><th>Score</th><th>Temperature</th>
                  <th>Offre</th><th>Action</th><th>Statut</th><th>Derniere analyse</th><th>Prochaine action</th>
                </tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>`
      }
    </div>`;

  document.getElementById('sort-select')?.addEventListener('change', (e) => {
    renderPipelineTable(prospects, e.target.value);
  });

  document.querySelectorAll('tbody tr').forEach((tr) => {
    tr.addEventListener('click', () => {
      window.location.hash = `#/prospect/${encodeURIComponent(tr.dataset.id)}`;
    });
  });
}

// ---------- Vue : Top prospects ----------

async function renderTop() {
  app.innerHTML = `<h1>Top prospects</h1><p class="page-subtitle">Chargement...</p>`;
  const top = await apiGet('/api/top?n=10');

  const items = top
    .map(
      (p, i) => `
      <div class="top-item" data-id="${escapeHtml(p.id)}">
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="top-rank">${i + 1}</div>
          <div>
            <div class="top-name">${escapeHtml(p.prenom)} ${escapeHtml(p.nom)} ${p.entreprise ? `· ${escapeHtml(p.entreprise)}` : ''}</div>
            <div class="top-meta">Offre : ${escapeHtml(OFFER_LABELS[p.offre_recommandee] || p.offre_recommandee || '—')} · Prochaine action : ${escapeHtml(p.prochaine_action || '—')}</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-weight:700;">${p.score_total ?? '—'}/100</span>
          ${TEMPERATURE_BADGE[p.temperature] || ''}
        </div>
      </div>`
    )
    .join('');

  app.innerHTML = `
    <h1>Top prospects</h1>
    <p class="page-subtitle">Les prospects les plus prioritaires aujourd'hui (hors prospects ignores). Qualite avant volume : tous ne necessitent pas une prise de contact.</p>
    ${top.length === 0 ? `<div class="card"><div class="empty-state">Aucun prospect prioritaire pour le moment.</div></div>` : `<div class="top-list">${items}</div>`}
  `;

  document.querySelectorAll('.top-item').forEach((el) => {
    el.addEventListener('click', () => {
      window.location.hash = `#/prospect/${encodeURIComponent(el.dataset.id)}`;
    });
  });
}

// ---------- Vue : Fiche prospect ----------

async function renderFiche(id) {
  app.innerHTML = `<p class="page-subtitle">Chargement...</p>`;
  let p;
  try {
    p = await apiGet(`/api/prospects/${encodeURIComponent(id)}`);
  } catch {
    app.innerHTML = `<a href="#/pipeline" class="back-link">← Retour au pipeline</a><div class="card"><p class="status-msg error">Prospect introuvable.</p></div>`;
    return;
  }

  const scoreHistoryRows = (p.historique_score || [])
    .slice()
    .reverse()
    .map((h) => `<tr><td>${formatDate(h.date)}</td><td>${h.score_total ?? '—'}</td><td>${escapeHtml(h.evenement || '—')}</td></tr>`)
    .join('');

  const tempHistoryRows = (p.historique_temperature || [])
    .slice()
    .reverse()
    .map((h) => `<tr><td>${formatDate(h.date)}</td><td>${TEMPERATURE_BADGE[h.temperature] || h.temperature}</td><td>${escapeHtml(h.evenement || '—')}</td></tr>`)
    .join('');

  const interactionRows = (p.historique_interactions || [])
    .slice()
    .reverse()
    .map((h) => `<tr><td>${formatDate(h.date)}</td><td>${escapeHtml(h.type || '—')}</td><td>${escapeHtml(h.note || '—')}</td></tr>`)
    .join('');

  app.innerHTML = `
    <a href="#/pipeline" class="back-link">← Retour au pipeline</a>
    <h1>${escapeHtml(p.prenom)} ${escapeHtml(p.nom)}</h1>
    <p class="page-subtitle">${escapeHtml(p.entreprise || '')} ${p.url_linkedin ? `· <a href="${escapeHtml(p.url_linkedin)}" target="_blank" rel="noopener">LinkedIn</a>` : ''}</p>

    <div class="card">
      <h2>Informations</h2>
      <div class="grid-2">
        <div class="kv"><div class="k">Pays</div><div class="v">${escapeHtml(p.pays || '—')}</div></div>
        <div class="kv"><div class="k">Type de prospect</div><div class="v">${escapeHtml(p.type_prospect || '—')}</div></div>
        <div class="kv"><div class="k">Activite</div><div class="v">${escapeHtml(p.activite || '—')}</div></div>
        <div class="kv"><div class="k">Offre (la sienne)</div><div class="v">${escapeHtml(p.offre || '—')}</div></div>
        <div class="kv"><div class="k">Audience</div><div class="v">${escapeHtml(p.audience || '—')}</div></div>
        <div class="kv"><div class="k">Statut pipeline</div><div class="v">${escapeHtml(p.statut_pipeline || '—')}</div></div>
        <div class="kv"><div class="k">Date de decouverte</div><div class="v">${formatDate(p.date_decouverte)}</div></div>
        <div class="kv"><div class="k">Derniere analyse</div><div class="v">${formatDate(p.derniere_analyse)}</div></div>
      </div>
      ${p.notes ? `<div class="kv"><div class="k">Notes</div><div class="v">${escapeHtml(p.notes)}</div></div>` : ''}
      ${(p.sources || []).length ? `<div class="kv"><div class="k">Sources</div><div class="v">${p.sources.map(escapeHtml).join('<br/>')}</div></div>` : ''}
    </div>

    ${p.derniere_analyse ? renderResultCard(p) : `<div class="card"><div class="empty-state">Ce prospect n'a pas encore ete analyse.</div></div>`}

    <div class="card">
      <h2>Relancer l'analyse</h2>
      <p class="hint">Utile si vous avez modifie les signaux ailleurs, ou pour marquer un nouvel evenement (ex: "a repondu a un message").</p>
      <form id="reanalyze-form" class="inline-form">
        <input type="text" name="event" placeholder="Evenement declencheur (optionnel)" />
        <button type="submit" class="btn secondary">Relancer l'analyse</button>
      </form>
      <span id="reanalyze-status" class="status-msg"></span>
    </div>

    <div class="card">
      <h2>Historique du score</h2>
      ${
        scoreHistoryRows
          ? `<table><thead><tr><th>Date</th><th>Score total</th><th>Evenement</th></tr></thead><tbody>${scoreHistoryRows}</tbody></table>`
          : `<div class="empty-state">Aucun historique pour le moment.</div>`
      }
    </div>

    <div class="card">
      <h2>Historique de temperature</h2>
      ${
        tempHistoryRows
          ? `<table><thead><tr><th>Date</th><th>Temperature</th><th>Evenement</th></tr></thead><tbody>${tempHistoryRows}</tbody></table>`
          : `<div class="empty-state">Aucun historique pour le moment.</div>`
      }
    </div>

    <div class="card">
      <h2>Interactions</h2>
      ${
        interactionRows
          ? `<table><thead><tr><th>Date</th><th>Type</th><th>Note</th></tr></thead><tbody>${interactionRows}</tbody></table>`
          : `<div class="empty-state">Aucune interaction enregistree (V1 : saisie manuelle a venir).</div>`
      }
    </div>
  `;

  document.getElementById('reanalyze-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const statusEl = document.getElementById('reanalyze-status');
    statusEl.textContent = 'Analyse en cours...';
    statusEl.className = 'status-msg';
    const eventValue = new FormData(e.target).get('event')?.trim() || undefined;
    try {
      await apiPost(`/api/prospects/${encodeURIComponent(p.id)}/analyze`, { event: eventValue });
      renderFiche(p.id);
    } catch (err) {
      statusEl.textContent = `Erreur : ${err.message}`;
      statusEl.className = 'status-msg error';
    }
  });
}
