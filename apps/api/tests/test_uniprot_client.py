import httpx

from proventl_api.lookup import UniProtRestClient


def test_uniprot_rest_client_returns_compact_metadata_for_found_record():
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "https://rest.uniprot.org/uniprotkb/Q9Y6K9.json"
        return httpx.Response(
            200,
            json={
                "primaryAccession": "Q9Y6K9",
                "genes": [{"geneName": {"value": "IKKB"}}],
                "proteinDescription": {
                    "recommendedName": {
                        "fullName": {
                            "value": "Inhibitor of nuclear factor kappa-B kinase subunit beta"
                        }
                    }
                },
                "comments": [
                    {
                        "commentType": "SIMILARITY",
                        "texts": [
                            {
                                "value": (
                                    "Belongs to the protein kinase superfamily. "
                                    "Ser/Thr protein kinase family."
                                )
                            }
                        ],
                    }
                ],
                "organism": {"scientificName": "Homo sapiens"},
            },
        )

    client = UniProtRestClient(http_client=httpx.Client(transport=httpx.MockTransport(handler)))

    result = client.lookup("Q9Y6K9")

    assert result.status == "found"
    assert result.metadata == {
        "uniprot_id": "Q9Y6K9",
        "gene": "IKKB",
        "protein_name": "Inhibitor of nuclear factor kappa-B kinase subunit beta",
        "organism": "Homo sapiens",
        "protein_families": (
            "protein kinase superfamily. Ser/Thr protein kinase family"
        ),
    }
