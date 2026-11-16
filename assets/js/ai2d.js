/* Retained extractor. Full function, callback, variable, and response contracts:
   docs/CODE-REFERENCE.md, section 6. Its model/backend is not bundled. */
/** Update the filename label with plain text. @param {Event} e */
document.getElementById('imageInput').addEventListener('change', function updateFileLabel(e) {
    const fileName = e.target.files[0]?.name || 'Choose Image';
    document.getElementById('fileLabel').textContent = `↑ ${fileName}`;
});

let currentJsonData = null;

/** Clone extractor markup authored at the bottom of pages/ultilities.html. */
function cloneToolTemplate(id) {
    return document.getElementById(id).content.firstElementChild.cloneNode(true);
}

/** Download the latest analysis JSON; do nothing before a successful response. */
function downloadJSON() {
    if (!currentJsonData) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentJsonData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "diagram_analysis.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

/** Build a vis graph, grouping blob_label pairs. @param {string} containerId @param {object} jsonData */
function buildExactGraph(containerId, jsonData) {
    if (!jsonData || !jsonData.blobs || !jsonData.relationships) return;
    if (!window.vis) throw new Error('The graph library could not load. Check your internet connection.');

    const nodesArray = [];
    const edgesArray = [];

    const colors = {
        root: "#FFD700",
        super_node: "#FF4500",
        blob: "#90EE90",
        text: "#87CEEB"
    };

    const imageId = jsonData.image_id ? jsonData.image_id.split('.')[0] : "Root";
    const rootId = "Image_Root";
    nodesArray.push({ 
        id: rootId, 
        label: `I${imageId}`, 
        color: { background: colors.root, border: '#333' }, 
        shape: 'ellipse',
        font: { face: 'bold' }
    });

    const processedBlobs = new Set();
    const processedTexts = new Set();
    const idToSuper = {};

    const blobMatches = jsonData.relationships.filter(r => r['relation_type:'] === 'blob_label');
    
    blobMatches.forEach(rel => {
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
            color: { background: colors.super_node, border: '#333' }, 
            shape: 'ellipse' 
        });

        edgesArray.push({ from: rootId, to: super_id, label: "has a", arrows: "to", color: "gray" });

        edgesArray.push({ from: super_id, to: b_id, color: "lightgray" });
        edgesArray.push({ from: super_id, to: t_id, color: "lightgray" });
    });

    jsonData.blobs.forEach(blob => {
        nodesArray.push({ 
            id: blob.id, 
            label: blob.id, 
            color: { background: colors.blob, border: '#333' }, 
            shape: 'ellipse' 
        });
        
        if (!processedBlobs.has(blob.id)) {
            edgesArray.push({ from: rootId, to: blob.id, label: "has a", arrows: "to", color: "gray" });
        }
    });

    (jsonData.texts || []).forEach(t => {
        nodesArray.push({ 
            id: t.id, 
            label: t.id, 
            color: { background: colors.text, border: '#333' }, 
            shape: 'ellipse' 
        });

        if (!processedTexts.has(t.id)) {
            edgesArray.push({ from: rootId, to: t.id, label: "has a", arrows: "to", color: "gray" });
        }
    });

    const mainRelationships = jsonData.relationships.filter(r => r['relation_type:'] !== 'blob_label');
    
    mainRelationships.forEach(rel => {
        let srcNode = rel.source;
        let tgtNode = rel.target;

        if (idToSuper[srcNode]) srcNode = idToSuper[srcNode];
        if (idToSuper[tgtNode]) tgtNode = idToSuper[tgtNode];

        edgesArray.push({
            from: srcNode,
            to: tgtNode,
            label: rel['relation_type:'],
            arrows: "to",
            color: "gray",
            font: { align: 'middle' }
        });
    });

    const container = document.getElementById(containerId);
    const graphData = {
        nodes: new vis.DataSet(nodesArray),
        edges: new vis.DataSet(edgesArray)
    };
    
    const options = {
        physics: {
            enabled: true,
            barnesHut: {
                gravitationalConstant: -3000,
                centralGravity: 0.1,
                springLength: 150,
                springConstant: 0.04
            }
        },
        layout: { randomSeed: 42 } 
    };

    new vis.Network(container, graphData, options);
}

/** Upload the selected diagram, render server outputs, and always clear the busy state. @returns {Promise<void>} */
async function processDiagram() {
    const fileInput = document.getElementById('imageInput');
    const statusText = document.getElementById('status');
    const gallery = document.getElementById('image-gallery');
    const analyzeButton = document.getElementById('analyzeButton');
    
    if (fileInput.files.length === 0) {
        alert("Please select an image first!");
        return;
    }

    gallery.replaceChildren();
    currentJsonData = null;
    analyzeButton.disabled = true;
    statusText.replaceChildren(cloneToolTemplate('ai2d-loading-template'));

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    
    const inputImageUrl = URL.createObjectURL(fileInput.files[0]);

    try {
        const response = await fetch('http://localhost:5000/api/analyze', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error("Server error");
        
        const data = await response.json();
        currentJsonData = data.json_data; 
        statusText.innerText = "Analysis Complete!";

        const orderedCards = [
            { title: "Input Image", url: inputImageUrl },
            { title: "Relationships", url: data.images?.relationships },
            { title: "Text Matching", url: data.images?.text_matching },
            { title: "CLIP Results", url: data.images?.clip_results },
            { title: "Knowledge Graph", url: data.images?.knowledge_graph } 
        ];

        orderedCards.forEach(card => {
            if (card.url) {
                const cardDiv = cloneToolTemplate('ai2d-image-template');
                cardDiv.querySelector('h4').textContent = card.title;
                cardDiv.querySelector('a').href = card.url;
                cardDiv.querySelector('img').src = card.url;
                cardDiv.querySelector('img').alt = card.title;
                gallery.appendChild(cardDiv);
            }
        });

        const jsonCard = cloneToolTemplate('ai2d-json-template');
        gallery.appendChild(jsonCard);
        document.getElementById('json-output').textContent = JSON.stringify(currentJsonData, null, 2);

        if (currentJsonData && currentJsonData.blobs && currentJsonData.relationships) {
            const graphCard = cloneToolTemplate('ai2d-graph-template');
            gallery.appendChild(graphCard);

            buildExactGraph('mynetwork', currentJsonData);
        }
        
    } catch (error) {
        statusText.innerText = `Analysis could not finish: ${error.message}. Check the local backend and graph library.`;
        console.error(error);
    } finally {
        analyzeButton.disabled = false;
    }
}

const dynamicGallery = document.getElementById('image-gallery');
const modalElement = document.getElementById("zoomModal");
const dynamicZoomedImg = document.getElementById("zoomedImg");
const dynamicZoomedText = document.getElementById("zoomedText");
const modalImgClass = document.querySelector('.modal-content-image');
const modalTextClass = document.querySelector('.modal-content-text');
const dynamicCloseBtn = document.getElementById("closeZoom");

/** Open an enlarged result image from delegated gallery clicks. @param {MouseEvent} event */
dynamicGallery.addEventListener('click', function handleGalleryClick(event) {
    if (event.target.tagName === 'IMG' && event.target.closest('.ai2d-result-card')) {
        event.preventDefault(); 
        
        let imgSrc = event.target.src;
        modalElement.style.display = "block";
        dynamicZoomedImg.src = imgSrc;
        modalImgClass.style.display = "block";
        modalTextClass.style.display = "none";
        document.body.style.overflow = "hidden";
        dynamicCloseBtn.focus();
    }
});

/** Close the image overlay and restore scroll/focus to the analyse control. */
function closeZoom() {
    modalElement.style.display = "none";
    document.body.style.overflow = "auto"; 
    document.getElementById('analyzeButton').focus();
}
dynamicCloseBtn.onclick = closeZoom;

/** Close only when the overlay background itself is clicked. @param {MouseEvent} event */
modalElement.onclick = function handleBackdropClick(event) {
    if (event.target == modalElement) {
        closeZoom();
    }
}
/** Keep keyboard focus in the image viewer; Escape closes it. @param {KeyboardEvent} event */
modalElement.addEventListener('keydown', function handleZoomKey(event) {
    if (event.key === 'Escape') closeZoom();
    if (event.key === 'Tab') { event.preventDefault(); dynamicCloseBtn.focus(); }
});
