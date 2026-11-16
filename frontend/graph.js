export function buildExactGraph(containerId, jsonData) {
  if (!jsonData || !jsonData.blobs || !jsonData.relationships) return;
  if (!window.vis)
    throw new Error(
      "The graph library could not load. Check your internet connection.",
    );

  const nodesArray = [];
  const edgesArray = [];

  const colors = {
    root: "#FFD700",
    super_node: "#FF4500",
    blob: "#90EE90",
    text: "#87CEEB",
  };

  const imageId = jsonData.image_id ? jsonData.image_id.split(".")[0] : "Root";
  const rootId = "Image_Root";
  nodesArray.push({
    id: rootId,
    label: `I${imageId}`,
    color: { background: colors.root, border: "#333" },
    shape: "ellipse",
    font: { face: "bold" },
  });

  const processedBlobs = new Set();
  const processedTexts = new Set();
  const idToSuper = {};

  const blobMatches = jsonData.relationships.filter(
    (r) => r["relation_type:"] === "blob_label",
  );

  blobMatches.forEach((rel) => {
    const t_id = rel.source;
    const b_id = rel.target;
    const super_id = `${b_id}+${t_id}`;

    idToSuper[b_id] = super_id;
    idToSuper[t_id] = super_id;
    processedBlobs.add(b_id);
    processedTexts.add(t_id);

    nodesArray.push({
      id: super_id,
      label: super_id,
      color: { background: colors.super_node, border: "#333" },
      shape: "ellipse",
    });

    edgesArray.push({
      from: rootId,
      to: super_id,
      label: "has a",
      arrows: "to",
      color: "gray",
    });

    edgesArray.push({ from: super_id, to: b_id, color: "lightgray" });
    edgesArray.push({ from: super_id, to: t_id, color: "lightgray" });
  });

  jsonData.blobs.forEach((blob) => {
    nodesArray.push({
      id: blob.id,
      label: blob.id,
      color: { background: colors.blob, border: "#333" },
      shape: "ellipse",
    });

    if (!processedBlobs.has(blob.id)) {
      edgesArray.push({
        from: rootId,
        to: blob.id,
        label: "has a",
        arrows: "to",
        color: "gray",
      });
    }
  });

  (jsonData.texts || []).forEach((t) => {
    nodesArray.push({
      id: t.id,
      label: t.id,
      color: { background: colors.text, border: "#333" },
      shape: "ellipse",
    });

    if (!processedTexts.has(t.id)) {
      edgesArray.push({
        from: rootId,
        to: t.id,
        label: "has a",
        arrows: "to",
        color: "gray",
      });
    }
  });

  const mainRelationships = jsonData.relationships.filter(
    (r) => r["relation_type:"] !== "blob_label",
  );

  mainRelationships.forEach((rel) => {
    let srcNode = rel.source;
    let tgtNode = rel.target;

    if (idToSuper[srcNode]) srcNode = idToSuper[srcNode];
    if (idToSuper[tgtNode]) tgtNode = idToSuper[tgtNode];

    edgesArray.push({
      from: srcNode,
      to: tgtNode,
      label: rel["relation_type:"],
      arrows: "to",
      color: "gray",
      font: { align: "middle" },
    });
  });

  const container = document.getElementById(containerId);
  const graphData = {
    nodes: new vis.DataSet(nodesArray),
    edges: new vis.DataSet(edgesArray),
  };

  const options = {
    physics: {
      enabled: true,
      barnesHut: {
        gravitationalConstant: -3000,
        centralGravity: 0.1,
        springLength: 150,
        springConstant: 0.04,
      },
    },
    layout: { randomSeed: 42 },
  };

  return new window.vis.Network(container, graphData, options);
}
