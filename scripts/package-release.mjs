import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
const files = [
  'frontend/src/App.tsx','frontend/src/api.ts','frontend/src/types.ts','frontend/src/pages.tsx','frontend/src/simulation.tsx','frontend/src/ui.tsx','frontend/src/styles.css',
  'frontend/tsconfig.app.json','frontend/nginx.conf','frontend/Dockerfile.prebuilt','frontend/Dockerfile.prebuilt.dockerignore',
  'services/ai-engine/app/main.py','services/ai-engine/app/vision.py','services/ai-engine/requirements.txt','services/ai-engine/Dockerfile',
  'services/gateway/src/main/java/com/cypher/gateway/api/IngestionController.java','services/gateway/src/main/java/com/cypher/gateway/api/CameraController.java','services/gateway/src/main/java/com/cypher/gateway/api/IncidentController.java',
  'services/gateway/src/main/java/com/cypher/gateway/model/IncidentEntity.java','services/gateway/src/main/java/com/cypher/gateway/repository/IncidentRepository.java','services/gateway/src/main/resources/application.yml',
  'database/init/001_schema.sql','database/migrations/002_simulation.sql','docker-compose.yml','docker-compose.prebuilt.yml','scripts/deploy-small.sh','SIMULATION.md',
]
function visit(path) { for(const item of readdirSync(path,{withFileTypes:true})) { if(item.isDirectory())visit(`${path}/${item.name}`);else files.push(`${path}/${item.name}`) } }
visit('frontend/dist')
mkdirSync('artifacts',{recursive:true})
writeFileSync('release-files.txt', files.join('\n')+'\n')
execFileSync('tar',['-czf','artifacts/cypher-update.tar.gz','--no-xattrs','release-files.txt',...files],{stdio:'inherit'})
console.log(resolve('artifacts/cypher-update.tar.gz'))
