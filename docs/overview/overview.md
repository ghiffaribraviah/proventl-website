# ProVenTL Website Overview

## Overview

ProVenTL is a web-based interface for exploring peptide-protein interaction predictions between snake venom-derived peptides and cancer-related proteins. The project is based on the ProVenTL framework from Adhiva et al. (2026), which applies transfer learning and ProtT5 protein language model embeddings to prioritize *Calloselasma rhodostoma* venom peptides with potential anticancer relevance.

The underlying model workflow uses encoded peptide-protein pairs as input to a trained deep learning model, with the paper identifying ProtT5 embeddings combined with an SAE-DNN classifier as the best-performing approach. The website is intended to make this model usable through a focused prediction dashboard where users enter a UniProt target protein ID, adjust a confidence threshold, review ranked venom peptide candidates, and inspect target protein metadata.

## Features

- UniProt Entry ID search for cancer-related target proteins.
- Prediction workflow for ranking snake venom-derived peptide candidates against a selected protein target.
- Adjustable confidence threshold for classifying predicted interactions as positive or negative.
- Ranked candidate table showing peptide sequence, confidence score, and prediction result.
- Confidence score visualization with compact progress bars for quick comparison.
- Target protein profile panel showing UniProt ID, protein name, gene, organism, key functions, sequence length, and molecular weight.
- Integration with the UniProt REST API to fetch target protein metadata.
- Example UniProt IDs for quick testing and demonstration.
- Loading state that communicates when ProVenTL inference is running.
- Pagination for browsing larger candidate result sets.
- CSV export for downloading ranked prediction results.
- IPB University-branded visual design using blue/yellow accents, glass-style panels, responsive layout, and mobile-friendly table cards.
