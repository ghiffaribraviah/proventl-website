# Upstream ProVenTL Reference

This directory contains a reference copy of the upstream ProVenTL repository:

- Source: https://github.com/TropBRC-BioinfoLab/ProVenTL
- Commit inspected: `930e06128350cfb3a90017d9d1518fcd39ee953d`
- Copied for: website/backend planning, reproducibility checks, and comparison against the local model assets.

Important files for this website project:

- `ProVenTL/2-feature_extraction/2. ProtT5_features.ipynb` documents the original ProtT5 embedding extraction method.
- `ProVenTL/2-feature_extraction/4. data_prediction.ipynb` generates the peptide-protein prediction matrix from cached embeddings.
- `ProVenTL/3. modelling/ProVenTL.ipynb` contains the SAE-DNN training and best-model selection workflow.
- `ProVenTL/4-prediction/prediction model.ipynb` contains classifier inference and the score-distribution p-value post-processing.
- `ProVenTL/Supplementary Files/Supplementary 3. final_prediction_venom_results.csv` contains the 498 significant prediction results used as a useful validation fixture.

The nested upstream `.git` directory was intentionally not retained.
