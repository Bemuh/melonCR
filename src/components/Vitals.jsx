import { useState } from 'react';
import { run } from '../db/index.js';
import { nowIso } from '../utils.js';

export default function Vitals({ encounter, setEncounter }) {
  const v = encounter.vitals_json ? JSON.parse(encounter.vitals_json) : {};
  const [state, setState] = useState({ taS: v.taS || '', taD: v.taD || '', fc: v.fc || '', fr: v.fr || '', temp: v.temp || '', spo2: v.spo2 || '', talla: v.talla || '', peso: v.peso || '', bmi: v.bmi || '' });

  function calcBMI(next) {
    const talla = Number(next.talla || state.talla || 0);
    const peso = Number(next.peso || state.peso || 0);
    return (peso && talla) ? (peso / ((talla / 100) ** 2)).toFixed(1) : '';
  }

  async function save(next) {
    const data = { ...state, ...next };
    data.bmi = calcBMI(next);
    await run(`UPDATE encounters SET vitals_json=$v, updated_at=$ua WHERE id=$id`, { $v: JSON.stringify(data), $id: encounter.id, $ua: nowIso() });
    setState(data);
    setEncounter({ ...encounter, vitals_json: JSON.stringify(data) });
  }

  function field(name, labelText) {
    return <label>{labelText}<input defaultValue={state[name]} onBlur={e => save({ [name]: e.target.value })} data-testid={`input-vitals-${name}`} /></label>;
  }

  return <div className='row'>
    {field('taS', 'TA Sistólica')}{field('taD', 'TA Diastólica')}{field('fc', 'FC')}{field('fr', 'FR')}
    {field('temp', 'Temperatura °C')}{field('spo2', 'SatO₂ %')}{field('talla', 'Talla (cm)')}{field('peso', 'Peso (kg)')}
    <div className='small'>IMC: <span className='badge'>{state.bmi || '-'}</span></div>
  </div>;
}
