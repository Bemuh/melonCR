import { useEffect, useState } from 'react';
import { exec, run } from '../db/index.js';

export default function Procedures({ encounter, onCountChange }){
  const [list,setList]=useState([]);
  const [pr,setPr]=useState({ name:'', code:'', technique:'', anatomical_site:'', materials:'', dose_per_site:'', lot_number:'', lot_expiry:'', responsible:'', consent_obtained:false });

  function reload(){
    const rows = exec(`SELECT * FROM procedures WHERE encounter_id=$id`, { $id:encounter.id });
    setList(rows);
    onCountChange?.(rows.length);
  }

  useEffect(()=>{ reload() }, [encounter?.id]);

  async function add(){
    if (!pr.name) return alert('Nombre del procedimiento');
    await run(`INSERT INTO procedures (id, encounter_id, name, code, technique, anatomical_site, materials, dose_per_site, lot_number, lot_expiry, responsible, consent_obtained)
      VALUES ($id,$e,$n,$c,$t,$a,$m,$d,$l,$x,$r,$co)`, {
      $id:crypto.randomUUID(), $e:encounter.id, $n:pr.name, $c:pr.code, $t:pr.technique, $a:pr.anatomical_site, $m:pr.materials,
      $d:pr.dose_per_site, $l:pr.lot_number, $x:pr.lot_expiry, $r:pr.responsible, $co:pr.consent_obtained?1:0
    });
    setPr({ name:'', code:'', technique:'', anatomical_site:'', materials:'', dose_per_site:'', lot_number:'', lot_expiry:'', responsible:'', consent_obtained:false });
    reload();
  }

  async function del(id){ await run(`DELETE FROM procedures WHERE id=$id`, { $id:id }); reload(); }

  return <div>
    <div className='row'>
      <label>Nombre<input value={pr.name} onChange={e=>setPr({...pr, name:e.target.value})} /></label>
      <label>Código (CUPS)<input value={pr.code} onChange={e=>setPr({...pr, code:e.target.value})} /></label>
      <label>Sitio anatómico<input value={pr.anatomical_site} onChange={e=>setPr({...pr, anatomical_site:e.target.value})} /></label>
    </div>
    <div className='row'>
      <label>Técnica<input value={pr.technique} onChange={e=>setPr({...pr, technique:e.target.value})} /></label>
      <label>Materiales/insumos<input value={pr.materials} onChange={e=>setPr({...pr, materials:e.target.value})} /></label>
      <label>Dosis por sitio<input value={pr.dose_per_site} onChange={e=>setPr({...pr, dose_per_site:e.target.value})} /></label>
    </div>
    <div className='row'>
      <label>Lote<input value={pr.lot_number} onChange={e=>setPr({...pr, lot_number:e.target.value})} /></label>
      <label>Vencimiento<input value={pr.lot_expiry} onChange={e=>setPr({...pr, lot_expiry:e.target.value})} /></label>
      <label>Responsable<input value={pr.responsible} onChange={e=>setPr({...pr, responsible:e.target.value})} /></label>
      <label className="inline-center no-grow">
        <input type="checkbox" checked={pr.consent_obtained}
              onChange={e=>setPr({...pr, consent_obtained:e.target.checked})}/>
        Consentimiento obtenido
      </label>
    </div>
    <div className='row' style={{ marginTop: 12 }} ></div>
    <button onClick={add}>Agregar</button>
    <hr/>
    <ul>
      {list.map(it => <li key={it.id}>{it.name} {it.code?`(${it.code})`:''} — Sitio: {it.anatomical_site||'-'} — Lote: {it.lot_number||'-'} <button className='ghost' onClick={()=>del(it.id)}>Eliminar</button></li>)}
    </ul>
  </div>;
}
