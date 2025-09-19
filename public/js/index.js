import app from './lib/immersive-app.js';
import socket from './lib/socket.js';
import { drawParticipantBox, drawQuadrant } from './lib/canvas.js';

const LAYOUT_COORDS = {
    // Coordenadas para el presentador principal (gran recuadro central)
    mainPresenter: {
        x: 0,
        y: 0,
        width: 1, // Ocupa todo el ancho
        height: 1, // Ocupa todo el alto
    },
    // Coordenadas para los participantes pequeños (columnas laterales)
    smallParticipants: [
        // Columna Izquierda (cuatro recuadros)
        { x: 0.01, y: 0.01, width: 0.18, height: 0.235 }, // Top-Left 1
        { x: 0.01, y: 0.255, width: 0.18, height: 0.235 }, // Mid-Left 2
        { x: 0.01, y: 0.5, width: 0.18, height: 0.235 }, // Mid-Left 3
        { x: 0.01, y: 0.745, width: 0.18, height: 0.235 }, // Bottom-Left 4

        // Columna Derecha (cuatro recuadros)
        { x: 0.81, y: 0.01, width: 0.18, height: 0.235 }, // Top-Right 5
        { x: 0.81, y: 0.255, width: 0.18, height: 0.235 }, // Mid-Right 6
        { x: 0.81, y: 0.5, width: 0.18, height: 0.235 }, // Mid-Right 7
        { x: 0.81, y: 0.745, width: 0.18, height: 0.235 }, // Bottom-Right 8
    ],
};

let participants = [];
let mainPresenterId = ''; // Almacena el zoomID del presentador principal

const colors = {
    black: '#131619',
    blue: '#0e72ed',
    green: '#4b9d64',
    red: '#e8173d',
    yellow: '#ffbf39',
};

const settings = {
    cast: [],
    color: colors.blue,
    topic: 'Hey there 👋 You can create and select your own topic from the home page',
    uuid: '',
};

const classes = {
    bold: 'has-text-weight-bold',
    hidden: 'is-hidden',
    panel: 'panel-block',
};

/*  Page Elements */
const canvas = document.getElementById('uiCanvas');
const ctx = canvas.getContext('2d');

// Content and Form Elements
const content = document.getElementById('main');
const controls = document.getElementById('controls');
const hostControls = document.getElementById('hostControls');

// Color Selection
const colorSel = document.getElementById('colorSel');
const custColorInp = document.getElementById('custColorInp');

// Cast selection
const castSel = document.getElementById('castSel');
const setCastBtn = document.getElementById('setCastBtn');

const helpMsg = document.getElementById('helpMsg');

// Topic Selection
const topicBtn = document.getElementById('topicBtn');
const topicInp = document.getElementById('topicInp');
const topicList = document.getElementById('topicList');

/**
 * Remove the hidden class from an element
 * @param {Element} el - element to hide
 */
function showEl(el) {
    el.classList.remove(classes.hidden);
}

/**
 * Add the hidden class to an element
 * @param {Element} el - element to show
 */
function hideEl(el) {
    el.classList.add(classes.hidden);
    el.classList.add(classes.hidden);
}

/**
 * Clear the in-page canvas for re-drawing
 */
function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Delay draw calls to prevent rendering too often
 * @param {Function} fn - function to debounce
 * @param {Number} ms - time to delay in milliseconds
 * @return {(function(...[*]): void)}
 */
function debounce(fn, ms = 250) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            fn.apply(this, args);
        }, ms);
    };
}

/**
 * Start the Immersive Context and send an invitation to all users
 * @return {Promise<void>}
 */
async function start() {
    hideEl(content);

    await app.start();
    await app.updateContext();

    showElements();

    if (app.isImmersive && app.userIsHost)
        await app.sdk.sendAppInvitationToAllParticipants();
}

const render = () => {
    if (!participants.length || !canvas || !canvas.getContext) {
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return;
    }

    // 1. Limpiar el canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. Dibujar el Presentador Principal
    const mainPresenterParticipant = participants.find(
        (p) => p.zoomID === mainPresenterId
    );
    if (mainPresenterParticipant && mainPresenterParticipant.video) {
        // Ajustar las coordenadas para que el presentador principal ocupe casi todo el espacio, dejando un margen
        const mainX = LAYOUT_COORDS.mainPresenter.x + 0.2; // Mover 20% a la derecha
        const mainY = LAYOUT_COORDS.mainPresenter.y + 0.05; // Mover 5% hacia abajo
        const mainWidth = LAYOUT_COORDS.mainPresenter.width - 0.4; // Reducir 40% del ancho (20% de cada lado)
        const mainHeight = LAYOUT_COORDS.mainPresenter.height - 0.1; // Reducir 10% del alto (5% de arriba y abajo)

        drawParticipantBox(
            ctx,
            mainPresenterParticipant,
            mainX,
            mainY,
            mainWidth,
            mainHeight,
            canvas.width,
            canvas.height
        );

        // Añadir un borde distintivo para el presentador principal
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 5;
        ctx.strokeRect(
            mainX * canvas.width,
            mainY * canvas.height,
            mainWidth * canvas.width,
            mainHeight * canvas.height
        );
    }

    // 3. Dibujar los Participantes Pequeños
    const smallParticipants = participants.filter(
        (p) => p.zoomID !== mainPresenterId
    );

    LAYOUT_COORDS.smallParticipants.forEach((coords, index) => {
        const participant = smallParticipants[index];
        if (participant && participant.video) {
            drawParticipantBox(
                ctx,
                participant,
                coords.x,
                coords.y,
                coords.width,
                coords.height,
                canvas.width,
                canvas.height
            );
            // Opcional: Añadir un borde delgado para los participantes pequeños
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.strokeRect(
                coords.x * canvas.width,
                coords.y * canvas.height,
                coords.width * canvas.width,
                coords.height * canvas.height
            );
        }
    });
};

/**
 * Redraw the text index only
 * @return {Promise<void>}
 */
async function drawTopic() {
    if (!app.isImmersive) return;

    // text is always at index 3
    const idx = 3;
    const oldId = app.drawnImages[idx];

    // Get the image data for the text quadrant
    const { img } = await drawQuadrant({
        idx,
        ctx,
        text: settings.topic,
    });

    // clear after because this op is quicker
    if (oldId) await app.clearImage(oldId);

    // draw our text image
    await app.drawImage(img);

    clearCanvas();
}

/**
 * Redraw one of the displayed participants
 * @param {Number} idx - index of the participant (0-2)
 * @param {String} p - participant ID
 * @return {Promise<void>}
 */
async function drawCastMember(idx, p) {
    if (!app.isImmersive || idx >= 3) return;

    const { img, participant } = await drawQuadrant({
        ctx,
        idx,
        participantId: p,
    });

    await app.drawImage(img);

    if (participant?.participantId) {
        const id = participant.participantId;
        const drawn = app.drawnParticipants[idx];

        if (drawn) await app.clearParticipant(drawn);

        if (id) await app.drawParticipant(participant);
    }

    clearCanvas();
}

/**
 * Handle socket-io update events sent from the meeting host
 * @param {String} topic - topic to use for the text quadrant
 * @param {Array.<String>} participants - participants to display
 * @param {String} color - UI color
 * @return {Promise<void>}
 */
async function onUpdate({ topic, participants, color }) {
    const changes = {
        topic: topic && settings.topic !== topic,
        color: color && settings.color !== color,
        participants: participants && settings.cast !== participants,
    };

    if (changes.topic) settings.topic = topic;

    if (changes.color) {
        settings.color = color;

        // sync this color change with the Zoom Client
        await app.sdk.postMessage({ color: settings.color });
    }

    if (changes.participants) settings.cast = participants;

    if (!app.isImmersive) return;

    const allChanged = Object.values(changes).reduce(
        (sum, next) => sum && next,
        true
    );

    const len = app.drawnImages.length;
    const hasImages = len > 0;

    if (allChanged || changes.color || (changes.participants && !hasImages))
        return await render();

    if (changes.topic) await drawTopic();

    if (changes.participants && hasImages)
        for (let i = 0; i < len; i++) {
            await drawCastMember(i, settings.cast[i]);
        }
}

/**
 * Set the participants in the Cast Selection element
 * @param {Array.<Object>} participants - Participant objects from the Zoom JS SDK
 */
function setCastSelect(participants) {
    for (let i = 0; i < castSel.options.length; i++) castSel.remove(i);

    for (const p of participants) {
        const prefix = p.role === 'host' ? '[You] ' : '';
        const opt = document.createElement('option');

        opt.value = p.participantId;
        opt.text = `${prefix}${p.screenName}`;

        castSel.appendChild(opt);
    }
}

// Función para poblar el select de presentadores
const populateMainPresenterSelect = () => {
    const mainPresenterSelect = document.getElementById('mainPresenterSelect');
    if (!mainPresenterSelect) return;

    // Guardar la selección actual antes de repoblar
    const currentSelection = mainPresenterSelect.value;

    // Limpiar opciones existentes, excepto la primera (None)
    while (mainPresenterSelect.options.length > 1) {
        mainPresenterSelect.remove(1);
    }

    // Añadir participantes como opciones
    app.participants.forEach((p) => {
        const option = document.createElement('option');
        option.value = p.zoomID;
        option.textContent = p.displayName;
        mainPresenterSelect.appendChild(option);
    });

    // Restaurar la selección si el participante sigue existiendo
    if (
        currentSelection &&
        app.participants.some((p) => p.zoomID === currentSelection)
    ) {
        mainPresenterSelect.value = currentSelection;
    } else {
        mainPresenterSelect.value = ''; // Resetear si el presentador anterior ya no está
        mainPresenterId = ''; // También resetear la variable interna
        socket.emit('set-main-presenter', ''); // Notificar a todos que no hay presentador principal
    }
};

/**
 * Hide and Show elements based on the Zoom Running Context
 */
function showElements() {
    const { style } = document.body;
    if (app.isImmersive) {
        style.overflow = 'hidden';
        hideEl(content);
    } else showEl(content);

    if (app.isInMeeting) {
        if (app.userIsHost) {
            showEl(controls);
            hideEl(helpMsg);
        } else {
            helpMsg.innerText = 'This app must be started by the host';
        }
    }

    if (app.userIsHost) {
        showEl(hostControls);
        setCastSelect(app.participants);
        populateMainPresenterSelect();
    }
}

/**
 * Create an anchor tag and insert it into the topic list
 * @param {String} text - text of the new topic
 */
function createTopic(text) {
    const a = document.createElement('a');
    a.classList.add(classes.panel);

    const topicQuery = `a.${classes.panel}`;
    const idx = topicList.querySelectorAll(topicQuery).length;

    a.innerText = text;
    a.onclick = async (e) => {
        settings.topic = e.target.innerText;

        const siblings = a.parentElement.querySelectorAll(topicQuery);

        if (app.userIsHost)
            socket.emit('sendUpdate', {
                topic: settings.topic,
                meetingUUID: settings.uuid,
            });

        await app.sdk.postMessage({
            activeTopic: settings.topic,
            topicIndex: idx,
        });

        for (const tag of siblings)
            if (tag !== e.target) tag.classList.remove(classes.bold);
            else tag.classList.add(classes.bold);
    };

    topicList.appendChild(a);
}

/**
 * Sets the default topic to be drawn
 * @param {String} text - topic text
 * @param {Number} idx - index of the topic in the topicList
 */
function setTopic(idx, text) {
    const topics = topicList.querySelectorAll('a');

    for (let i = 0; i < topics.length; i++) {
        const topic = topics[i];

        if (i === idx) {
            topic.classList.add(classes.bold);
            continue;
        }

        topic.classList.remove(classes.bold);
    }

    settings.topic = text;

    // sync active topic with other participants
    socket.emit('sendUpdate', {
        meetingUUID: settings.uuid,
        topic: settings.topic,
    });
}

/*  Zoom Event Handlers */

app.sdk.onConnect(async () => {
    if (app.isInClient) return;

    await app.sdk.postMessage({
        participants: app.participants,
        color: settings.color,
        isHost: app.userIsHost,
        uuid: settings.uuid,
    });
});

app.sdk.onMeeting(({ action }) => {
    if (action === 'ended') socket.disconnect();
});

app.sdk.onParticipantChange(async ({ participants: sdkParticipants }) => {
    for (const part of sdkParticipants) {
        const p = {
            participantId: part.participantId.toString(),
            screenName: part.screenName,
            role: part.role,
        };

        const i = app.participants.findIndex(
            ({ participantId }) => participantId === p.participantId
        );

        if (part.status === 'leave' && i !== -1) {
            app.participants.splice(i, 1);
            const idx = settings.cast.indexOf(p.participantId);

            if (idx === -1) return;

            settings.cast.splice(idx, 1);

            if (app.isImmersive) await app.clearParticipant(p.participantId);
        } else {
            app.participants.push(p);
        }
    }

    participants = app.participants;

    await app.sdk.postMessage({ participants: app.participants });
    setCastSelect(app.participants);
    if (app.userIsHost) {
        populateMainPresenterSelect();
    }
    render();
});

app.sdk.onMessage(async ({ payload }) => {
    const {
        addTopic,
        color,
        updateCast,
        ended,
        isHost,
        participants: payloadParticipants,
        activeTopic,
        topicIndex,
        uuid,
    } = payload;

    // If we have a UUID the meeting was started
    if (uuid) {
        showEl(controls);
        settings.uuid = uuid;
    }

    // hide controls when the meeting ends
    if (ended) {
        hideEl(controls);
        hideEl(hostControls);
    }

    // if the user is the host show host controls
    if (isHost) {
        showEl(hostControls);
        setCastSelect(app.participants);
    }

    // sync the list of participants
    if (payloadParticipants) {
        helpMsg.classList.add(classes.hidden);
        controls.classList.remove(classes.hidden);
        setCastSelect(payloadParticipants);
        participants = payloadParticipants;
        if (app.userIsHost) {
            populateMainPresenterSelect();
        }
    }

    // sync the list of displayed participants and draw them
    if (updateCast) {
        settings.cast = updateCast.slice(0, 3);

        if (app.isInMeeting) await start();
        else if (app.isImmersive) {
            const len = app.drawnImages.length;
            if (len <= 0) await render();
            else
                for (let i = 0; i < len; i++) {
                    const p = settings.cast[i];
                    if (!p) continue;

                    await drawCastMember(i, p);
                }
        }
    }

    // sync the UI color
    if (color) {
        const idx = Object.values(colors).indexOf(color);
        const isCustom = idx === -1;

        settings.color = color;

        if (isCustom) {
            custColorInp.value = color;
            colorSel.setAttribute('disabled', '');
        } else {
            colorSel.removeAttribute('disabled');
            colorSel.value = Object.keys(colors)[idx];
        }

        if (app.isImmersive) await render();
    }

    // sync a new topic
    if (addTopic) createTopic(addTopic);

    // set the default topic
    if (activeTopic) {
        setTopic(topicIndex, activeTopic);
        if (app.isImmersive) await drawTopic();
    }
});

/* DOM Event Handlers */

colorSel.onchange = async (e) => {
    if (custColorInp.innerText.length > 0) return;

    const color = colors[e.target.value];
    if (!color) return;

    settings.color = color;

    // sync the color change with the Zoom Client
    await app.sdk.postMessage({
        color,
    });

    // the host can override the color for everyone else
    socket.emit('sendUpdate', {
        color: settings.color,
        meetingUUID: settings.uuid,
    });
};

custColorInp.onchange = async (e) => {
    const { value } = e.target;
    if (value.length > 0) {
        settings.color = value;

        colorSel.setAttribute('disabled', '');

        // sync the color change with the Zoom Client
        await app.sdk.postMessage({
            color: settings.color,
        });

        if (app.userIsHost)
            socket.emit('sendUpdate', {
                color: settings.color,
                meetingUUID: settings.uuid,
            });
    } else colorSel.removeAttribute('disabled');
};

topicBtn.onclick = async () => {
    const topic = topicInp.value;

    if (!topic) return;

    createTopic(topic);

    // sync the new topic with the Zoom Client
    await app.sdk.postMessage({ addTopic: topic });
};

setCastBtn.onclick = async (event) => {
    event.preventDefault();
    const selected = castSel.querySelectorAll('option:checked');
    const hasUI = app.drawnImages.length > 0;

    const cast = [];

    for (let i = 0; i < 3 && i < selected.length; i++) {
        const id = selected[i].value;

        if (!id) continue;

        cast.push(id);

        // only redraw the participant if we have the UI
        if (hasUI) await drawCastMember(i, id);
    }

    settings.cast = cast;

    const updateCast = settings.cast;

    // determine what needs to be redrawn based on the running context
    if (app.isInMeeting) await start();
    else if (app.isImmersive && !hasUI) await render();
    else if (app.isInClient) await app.sdk.postMessage({ updateCast });

    // share this change with the other clients
    socket.emit('sendUpdate', {
        participants: settings.cast,
        topic: settings.topic,
        color: settings.color,
        meetingUUID: settings.uuid,
    });
};

window.onresize = debounce(render, 1000);

// === Lógica de Host para el Presentador Principal ===
if (app.userIsHost) {
    const mainPresenterSelect = document.getElementById('mainPresenterSelect');

    // Escuchar el evento de cambio en el select
    if (mainPresenterSelect) {
        mainPresenterSelect.addEventListener('change', (event) => {
            const selectedId = event.target.value;
            mainPresenterId = selectedId;
            socket.emit('set-main-presenter', selectedId); // Emitir el cambio al servidor
            render(); // Renderizar inmediatamente en el host
        });
    }
}

// === Lógica de Cliente (Host y Viewers) para recibir cambios del Presentador Principal ===
socket.on('main-presenter-update', (presenterId) => {
    mainPresenterId = presenterId;
    render(); // Volver a renderizar en todos los clientes cuando el presentador cambia
});

(async () => {
    try {
        // Initialize the Zoom JS SDK
        await app.init();

        if (!app.isInClient) {
            const { meetingUUID } = await app.sdk.getMeetingUUID();
            settings.uuid = meetingUUID;

            // connect to the Zoom Client
            await app.sdk.connect();

            if (!app.userIsHost) {
                socket.on('update', onUpdate);
                socket.emit('join', { meetingUUID: settings.uuid });
            }
        }
        showElements();
    } catch (e) {
        console.error(e);
    }
})();
