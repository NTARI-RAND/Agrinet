'use client';

import { useEffect, useState } from 'react';
import {
  CROPS, MAX_PLAN_BYTES, createPlan, analyzePlan, previewResize, plantSquare,
  serializePlan, parsePlan, saveLocalPlan, loadLocalPlan,
} from '../lib/gardenPlanner';
import { getPlantsPerSquare } from '../../backend/utils/squareFootGardening';
import styles from './GardenPlanner.module.css';

const cropNames = { tomato: 'Tomato', lettuce: 'Lettuce', carrot: 'Carrot', basil: 'Basil' };
const dateLabel = value => new Date(`${value}T00:00:00Z`).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const squareLabel = ([r, c]) => `row ${r + 1}, column ${c + 1}`;

export default function GardenPlanner() {
  const [plan, setPlan] = useState(null);
  const [selectedCrop, setSelectedCrop] = useState('tomato');
  const [dimensions, setDimensions] = useState({ rows: '4', columns: '4' });
  const [savedText, setSavedText] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [pendingResize, setPendingResize] = useState(null);

  useEffect(() => {
    const today = new Date();
    const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    let initial = createPlan(4, 4, localDate);
    try {
      const saved = loadLocalPlan(window.localStorage);
      if (saved) {
        initial = saved;
        setSavedText(serializePlan(saved));
        setNotice('Saved plan restored from this browser.');
      }
    } catch {
      setError('Your saved plan could not be restored. You can still plan and export a file.');
    }
    setDimensions({ rows: String(initial.layout.length), columns: String(initial.layout[0].length) });
    setPlan(initial);
  }, []);

  if (!plan) return <section className={styles.planner}><h1>Garden planner</h1><p role="status">Opening your garden bed…</p><noscript>Enable JavaScript to edit a bed. Plans are calculated and saved in your browser.</noscript></section>;

  let analysis;
  let validationError = '';
  try { analysis = analyzePlan(plan); } catch (err) { validationError = err.message; }
  const dirty = !analysis || serializePlan(plan) !== savedText;
  const conflictSquares = new Set(analysis?.conflicts.flatMap(pair => [pair.first.join(','), pair.second.join(',')]) || []);

  function edit(next) {
    setPlan(next);
    setNotice('');
    setError('');
    setPendingResize(null);
  }

  function applySize(event) {
    event.preventDefault();
    try {
      const preview = previewResize(plan, Number(dimensions.rows), Number(dimensions.columns));
      if (preview.removedSquares > 0) {
        setPendingResize(preview);
        return;
      }
      edit(preview.plan);
    } catch (err) { setNotice(''); setError(err.message); }
  }

  function save() {
    try {
      saveLocalPlan(window.localStorage, plan);
      setSavedText(serializePlan(plan));
      setError('');
      setNotice('Plan saved in this browser. Export a copy to keep it elsewhere.');
    } catch { setNotice(''); setError('Could not save in this browser. Export your plan to keep a copy.'); }
  }

  function exportFile() {
    const url = URL.createObjectURL(new Blob([serializePlan(plan)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'agrinet-garden-plan.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Plan exported. Import the JSON file here to edit it again.');
  }

  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > MAX_PLAN_BYTES) throw new Error('Plan file is too large. Maximum size is 32 KB.');
      const next = parsePlan(await file.text());
      if (analysis?.occupiedSquares > 0 && !window.confirm('Replace the current bed with this imported plan? Unsaved changes will be lost.')) return;
      edit(next);
      setDimensions({ rows: String(next.layout.length), columns: String(next.layout[0].length) });
      setNotice('Plan imported. Save in this browser to keep it after reloading.');
    } catch (err) { setNotice(''); setError(err.message); }
  }

  return (
    <section className={styles.planner}>
      <div className={styles.heading}>
        <p className={styles.kicker}>AGRINET / GROWING TOGETHER</p>
        <h1>A little space.<br /><span>A growing plan.</span></h1>
        <p>Choose a crop, then plant a square. See what fits and when it could be ready.</p>
      </div>

      <div className={styles.toolbar}>
        <span className={styles.saveState}>{dirty ? 'Unsaved plan' : 'Saved in this browser'}</span>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} disabled={!analysis} onClick={save}>Save plan</button>
          <button type="button" disabled={!analysis} onClick={exportFile}>Export JSON</button>
          <label className={styles.importButton}>Import JSON<input type="file" accept=".json,application/json" aria-label="Import garden plan" onChange={importFile} /></label>
        </div>
      </div>
      <p className={styles.privacy}>Your plan stays on this device. Saving uses this browser’s storage; export a file to move it.</p>
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {(error || validationError) && <p className={styles.error} role="alert">{error || validationError}</p>}
      {pendingResize && <div className={styles.conflicts} role="alert">
        <p>Resizing to {pendingResize.plan.layout[0].length} × {pendingResize.plan.layout.length} ft removes {pendingResize.removedSquares} planted {pendingResize.removedSquares === 1 ? 'square' : 'squares'}.</p>
        <div className={styles.actions}>
          <button type="button" onClick={() => edit(pendingResize.plan)}>Resize and remove squares</button>
          <button type="button" onClick={() => {
            setPendingResize(null);
            setDimensions({ rows: String(plan.layout.length), columns: String(plan.layout[0].length) });
          }}>Keep current bed</button>
        </div>
      </div>}

      <div className={styles.workspace}>
        <aside className={styles.sidebar} aria-label="Bed settings and crops">
          <h2>Your bed</h2>
          <form onSubmit={applySize} className={styles.sizeForm}>
            <div className={styles.dimensions}>
              <label>Width (ft)<input type="number" min="1" max="8" step="1" required value={dimensions.columns} onChange={e => setDimensions({ ...dimensions, columns: e.target.value })} /></label>
              <label>Length (ft)<input type="number" min="1" max="8" step="1" required value={dimensions.rows} onChange={e => setDimensions({ ...dimensions, rows: e.target.value })} /></label>
            </div>
            <button type="submit" disabled={!analysis}>Resize bed</button>
          </form>
          <label className={styles.dateField}>Planting date<input type="date" required value={plan.startDate} onChange={e => edit({ ...plan, startDate: e.target.value })} /></label>
          <h2 className={styles.cropHeading}>Choose a crop</h2>
          <div className={styles.palette}>
            {CROPS.map(crop => <button key={crop} type="button" aria-pressed={selectedCrop === crop} onClick={() => setSelectedCrop(crop)} className={styles.cropOption}>
              <span className={`${styles.cropMark} ${styles[crop]}`} aria-hidden="true">{cropNames[crop][0]}</span>
              <span><strong>{cropNames[crop]}</strong><small>{getPlantsPerSquare(crop)} {getPlantsPerSquare(crop) === 1 ? 'plant' : 'plants'} / sq ft</small></span>
              {selectedCrop === crop && <span className={styles.selectedMark} aria-hidden="true">✓</span>}
            </button>)}
            <button type="button" aria-pressed={selectedCrop === null} onClick={() => setSelectedCrop(null)} className={styles.erase}>Erase a square</button>
          </div>
        </aside>

        <div className={styles.bedPanel}>
          <div className={styles.bedHeader}><h2>{plan.layout[0].length} × {plan.layout.length} ft bed</h2><span>Each square = 1 sq ft</span></div>
          <p className={styles.instruction}>{selectedCrop ? `Planting ${cropNames[selectedCrop].toLowerCase()}. Select any square to place it.` : 'Erasing. Select a planted square to clear it.'}</p>
          <div className={styles.bedScroll}>
            <div className={styles.bed} role="group" aria-label="Garden bed" style={{ '--columns': plan.layout[0].length }}>
              {plan.layout.flatMap((row, r) => row.map((crop, c) => <button type="button" key={`${r}-${c}`} disabled={!analysis} onClick={() => edit(plantSquare(plan, r, c, selectedCrop))}
                aria-label={`Row ${r + 1}, column ${c + 1}: ${crop ? cropNames[crop] : 'Empty'}`}
                className={`${styles.square} ${crop ? styles[crop] : styles.empty} ${conflictSquares.has(`${r},${c}`) ? styles.conflictSquare : ''}`}>
                {crop ? <><strong>{cropNames[crop][0]}</strong><span>{cropNames[crop]}</span><small>{getPlantsPerSquare(crop)} {getPlantsPerSquare(crop) === 1 ? 'plant' : 'plants'}</small></> : <><span aria-hidden="true">+</span><small>Plant here</small></>}
                {conflictSquares.has(`${r},${c}`) && <span className={styles.conflictMark} aria-label="Neighbor conflict">!</span>}
              </button>))}
            </div>
          </div>
          <dl className={styles.totals} aria-live="polite">
            <div><dt>Bed area</dt><dd>{plan.layout.length * plan.layout[0].length} <small>sq ft</small></dd></div>
            <div><dt>Planted squares</dt><dd>{analysis?.occupiedSquares ?? '—'}</dd></div>
            <div><dt>Total plants</dt><dd>{analysis?.totalPlants ?? '—'}</dd></div>
          </dl>
        </div>
      </div>

      {analysis?.conflicts.length > 0 && <section className={styles.conflicts} aria-labelledby="conflict-title" aria-live="polite">
        <h2 id="conflict-title">Give these crops different neighbors</h2>
        <ul>{analysis.conflicts.map(pair => <li key={pair.first.join(',') + ':' + pair.second.join(',')}>
          {cropNames[pair.crops[0]]} ({squareLabel(pair.first)}) and {cropNames[pair.crops[1]]} ({squareLabel(pair.second)}) are incompatible in Agrinet’s current crop rules.
        </li>)}</ul>
        <p>Choose another crop for either square, or erase it.</p>
      </section>}

      <section className={styles.harvest} aria-labelledby="harvest-title">
        <div className={styles.harvestHeading}><h2 id="harvest-title">A look ahead</h2><span>Estimated harvests</span></div>
        {!analysis ? <p>Choose a valid planting date to see estimates.</p> : analysis.crops.length === 0 ? <p className={styles.emptyHarvest}>Your harvest starts with one square. Choose a crop above to begin.</p> : <div className={styles.tableScroll}><table>
          <caption className={styles.srOnly}>Crop counts and estimated harvest dates</caption>
          <thead><tr><th scope="col">Crop</th><th scope="col">Squares</th><th scope="col">Plants</th><th scope="col">Estimated harvest</th></tr></thead>
          <tbody>{analysis.crops.map(crop => <tr key={crop.crop}><th scope="row"><span className={`${styles.tableDot} ${styles[crop.crop]}`} aria-hidden="true" />{cropNames[crop.crop]}</th><td>{crop.squares}</td><td>{crop.plants}</td><td><time dateTime={crop.harvestDate}>{dateLabel(crop.harvestDate)}</time></td></tr>)}</tbody>
        </table></div>}
        <p className={styles.estimateNote}>Uses Agrinet’s existing spacing, neighbor rules, and fixed days to maturity for four crops. Estimates do not account for variety, weather, soil, or your local growing season.</p>
      </section>
    </section>
  );
}
