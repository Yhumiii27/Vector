# Vector — données à fournir

Modèles CSV dans `docs/donnees/` (séparateur `;`, UTF-8, une ligne d'exemple **fictive** à remplacer). Un fichier qui
nomme des personnes réelles reste hors de Git (Norma § 3) : le déposer dans Codex et donner sa référence.

| Fichier | Question | Contenu | Qui |
| --- | --- | --- | --- |
| `01-partenaires.csv` | DA-1 | transporteurs, transitaires, emballeurs, assureurs, agents : raison sociale, pays, type, modes, zones, agréments | responsable des expéditions |
| `02-sites-et-adresses.csv` | DA-2 | sites de départ (code Matrix), horaires, quai, levage ; adresses de livraison fréquentes (sites miniers) | responsable des expéditions |
| `03-codes-sh.csv` | DA-3 | codes SH utilisés, désignation douanière, n° de contrôle double usage | conformité / transitaire |
| `04-politique-incoterms.csv` | DA-4 | Incoterm par type de flux | direction commerciale |
| `05-emballages.csv` | DA-5 | emballages standard (dimensions, tare, norme) | magasin / emballeur |
| `06-pays.csv` | DA-6 | niveau de risque, embargo, accord d'origine, documents exigés | conformité |
| `07-standards-couts.csv` | DA-7 | €/kg taxable par mode et zone | responsable des expéditions |
| `08-historique-expeditions.csv` | DA-7 | 12 mois d'expéditions (tableur actuel) | responsable des expéditions |
