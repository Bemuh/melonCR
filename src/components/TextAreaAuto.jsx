import { run } from '../db/index.js';
import { nowIso } from '../utils.js';

export default function TextAreaAuto({ encounter, setEncounter, field, label, "data-testid": testId }) {
  return (
    <label>{label}
      <textarea defaultValue={encounter[field] || ''}
        onBlur={async e => {
          const v = e.target.value;
          await run(`UPDATE encounters SET ${field}=$v, updated_at=$ua WHERE id=$id`, { $v: v, $id: encounter.id, $ua: nowIso() });
          setEncounter({ ...encounter, [field]: v });
        }}
        data-testid={testId}
      />
    </label>
  );
}
