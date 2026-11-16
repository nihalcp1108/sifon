import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { Area } from '../src/modules/areas/area.model.js';
import '../src/modules/sections/section.model.js'; // Ensure Section model registered

interface MigrationCandidate {
  _id: string;
  originalName?: string;
  areaNumber?: number;
  sectionName?: string;
  derivedName: string;
  hasCollision?: boolean;
}

async function run() {
  const isApply = process.argv.includes('--apply');
  console.log(`\n==================================================`);
  console.log(` LOCATION SIMPLIFICATION MIGRATION (${isApply ? 'APPLY MODE' : 'DRY RUN'})`);
  console.log(`==================================================\n`);

  try {
    await connectDatabase();

    const areas = await Area.find({}).populate('sectionId', 'name').lean();
    console.log(`Found ${areas.length} location records to inspect.\n`);

    if (areas.length === 0) {
      console.log('No location records found in database.');
      return;
    }

    const candidates: MigrationCandidate[] = [];
    const nameFrequency = new Map<string, number>();

    // Phase 1: Determine candidates
    for (const a of areas) {
      const section = a.sectionId as any;
      const sectionName = section && typeof section === 'object' && section.name ? section.name.trim() : undefined;
      const rawName = a.name ? a.name.trim() : (a.areaNumber ? `Area ${a.areaNumber}` : `Location ${a._id}`);

      let derivedName = rawName;
      if (sectionName && !rawName.toLowerCase().includes(sectionName.toLowerCase())) {
        derivedName = `${sectionName} — ${rawName}`;
      }

      // Track frequency for collision detection
      const lower = derivedName.toLowerCase();
      nameFrequency.set(lower, (nameFrequency.get(lower) || 0) + 1);

      candidates.push({
        _id: a._id.toString(),
        originalName: a.name,
        areaNumber: a.areaNumber,
        sectionName,
        derivedName,
      });
    }

    // Phase 2: Detect collisions and report
    let collisionCount = 0;
    const finalUpdates: { id: string; oldLabel: string; newLabel: string }[] = [];

    for (const c of candidates) {
      const lower = c.derivedName.toLowerCase();
      const count = nameFrequency.get(lower) || 1;

      let finalName = c.derivedName;
      if (count > 1) {
        c.hasCollision = true;
        collisionCount++;
        // Disambiguate with unique suffix to avoid silent merge
        finalName = `${c.derivedName} (Ref ${c._id.slice(-4).toUpperCase()})`;
      }

      finalUpdates.push({
        id: c._id,
        oldLabel: c.originalName || (c.areaNumber ? `Area ${c.areaNumber}` : 'Unnamed'),
        newLabel: finalName,
      });
    }

    // Print summary
    console.log(`--- Planned Conversions ---`);
    for (const u of finalUpdates) {
      const changed = u.oldLabel !== u.newLabel;
      console.log(`[ID ${u.id}] "${u.oldLabel}" -> "${u.newLabel}" ${changed ? '(UPDATED)' : '(NO CHANGE)'}`);
    }

    console.log(`\nTotal Records: ${areas.length}`);
    console.log(`Naming Collisions Detected & Disambiguated: ${collisionCount}`);

    if (!isApply) {
      console.log(`\n[DRY RUN COMPLETE] No records were modified.`);
      console.log(`To apply these changes to the database, run: npm run migrate:locations -- --apply\n`);
    } else {
      console.log(`\n[APPLYING CHANGES TO DATABASE]...`);
      for (const u of finalUpdates) {
        await Area.updateOne({ _id: u.id }, { $set: { name: u.newLabel } });
      }
      console.log(`[SUCCESS] Successfully updated ${finalUpdates.length} location records.\n`);
    }
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await disconnectDatabase();
  }
}

run();

