/**
 * Multiplayer System - Firebase Signaling + WebRTC P2P
 * Works fully on GitHub Pages (static hosting)
 */
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, off, push, remove, update, serverTimestamp } from 'firebase/database';

// Firebase config - REPLACE WITH YOUR OWN (free at firebase.google.com)
// For now, using a demo config - user needs to replace with their own
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const ROOM_ID = 'city-drive-lobby';
const MAX_PLAYERS = 16;

export class Multiplayer {
  constructor() {
    this.app = null;
    this.db = null;
    this.playerId = this.generatePlayerId();
    this.playerRef = null;
    this.players = new Map(); // id -> { car, peerConnection, dataChannel }
    this.localCar = null;
    this.connected = false;
    this.onPlayerJoin = null;
    this.onPlayerLeave = null;
    this.onStateUpdate = null;
    this.iceServers = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };
    this.sendInterval = null;
    this.pendingCandidates = new Map(); // playerId -> candidate[]
  }

  generatePlayerId() {
    return 'player_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
  }

  async init(firebaseConfig = null) {
    // Use provided config or default (user must replace)
    const config = firebaseConfig || FIREBASE_CONFIG;

    if (config.apiKey === "YOUR_API_KEY") {
      console.warn('[Multiplayer] Using demo Firebase config. Replace with your own in multiplayer.js or pass to init()');
      // Don't throw - allow offline mode for testing
      this.offlineMode = true;
      return false;
    }

    try {
      this.app = initializeApp(config);
      this.db = getDatabase(this.app);
      this.offlineMode = false;

      // Register this player in the lobby
      await this.joinLobby();

      // Listen for other players
      this.listenForPlayers();

      // Start sending our state
      this.startStateBroadcast();

      this.connected = true;
      console.log('[Multiplayer] Connected to lobby:', ROOM_ID);
      return true;
    } catch (e) {
      console.error('[Multiplayer] Init failed:', e);
      this.offlineMode = true;
      return false;
    }
  }

  async joinLobby() {
    this.playerRef = ref(this.db, `rooms/${ROOM_ID}/players/${this.playerId}`);
    await set(this.playerRef, {
      id: this.playerId,
      joinedAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
      car: null // Will be updated with car state
    });

    // Clean up on disconnect
    const connectedRef = ref(this.db, '.info/connected');
    onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        // Set up offline removal
        const playerRef = ref(this.db, `rooms/${ROOM_ID}/players/${this.playerId}`);
        update(playerRef, { lastSeen: serverTimestamp() });
      }
    });
  }

  listenForPlayers() {
    const playersRef = ref(this.db, `rooms/${ROOM_ID}/players`);
    onValue(playersRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      const now = Date.now();
      const activePlayers = new Set();

      for (const [id, playerData] of Object.entries(data)) {
        if (id === this.playerId) continue;
        if (!playerData.car) continue;

        activePlayers.add(id);

        // New player joined
        if (!this.players.has(id)) {
          this.handlePlayerJoin(id, playerData);
        }

        // Update remote car state
        if (this.players.has(id) && this.onStateUpdate) {
          this.onStateUpdate(id, playerData.car);
        }
      }

      // Handle players who left
      for (const [id] of this.players) {
        if (!activePlayers.has(id)) {
          this.handlePlayerLeave(id);
        }
      }
    });
  }

  handlePlayerJoin(id, playerData) {
    console.log('[Multiplayer] Player joined:', id);

    // Create peer connection for WebRTC
    const pc = new RTCPeerConnection(this.iceServers);
    const dataChannel = pc.createDataChannel('game', { ordered: false, maxRetransmits: 0 });

    this.setupDataChannel(id, dataChannel);
    this.setupPeerConnection(id, pc);

    this.players.set(id, {
      car: null,
      peerConnection: pc,
      dataChannel: dataChannel,
      pendingCandidates: []
    });

    // Create offer
    pc.createOffer().then(offer => {
      pc.setLocalDescription(offer);
      this.sendSignal(id, { type: 'offer', offer });
    }).catch(e => console.error('[Multiplayer] Create offer failed:', e));

    if (this.onPlayerJoin) this.onPlayerJoin(id, playerData);
  }

  handlePlayerLeave(id) {
    console.log('[Multiplayer] Player left:', id);
    const player = this.players.get(id);
    if (player) {
      player.peerConnection.close();
      this.players.delete(id);
    }
    if (this.onPlayerLeave) this.onPlayerLeave(id);
  }

  setupDataChannel(id, channel) {
    channel.onopen = () => {
      console.log('[Multiplayer] DataChannel open with:', id);
      // Send any queued candidates
      const player = this.players.get(id);
      if (player && player.pendingCandidates.length > 0) {
        for (const candidate of player.pendingCandidates) {
          this.sendSignal(id, { type: 'candidate', candidate });
        }
        player.pendingCandidates = [];
      }
    };

    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'state' && this.onStateUpdate) {
          this.onStateUpdate(id, data.payload);
        }
      } catch (e) {
        console.error('[Multiplayer] Message parse error:', e);
      }
    };

    channel.onclose = () => {
      console.log('[Multiplayer] DataChannel closed:', id);
    };
  }

  setupPeerConnection(id, pc) {
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(id, { type: 'candidate', candidate: event.candidate });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[Multiplayer] ICE state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        this.handlePlayerLeave(id);
      }
    };

    pc.ondatachannel = (event) => {
      const channel = event.channel;
      this.setupDataChannel(id, channel);
      const player = this.players.get(id);
      if (player) player.dataChannel = channel;
    };
  }

  async sendSignal(targetId, signal) {
    const signalRef = ref(this.db, `rooms/${ROOM_ID}/signals/${this.playerId}_${targetId}`);
    await push(signalRef, {
      from: this.playerId,
      to: targetId,
      ...signal,
      timestamp: serverTimestamp()
    });
  }

  listenForSignals() {
    const signalsRef = ref(this.db, `rooms/${ROOM_ID}/signals`);
    onValue(signalsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      for (const [key, signal] of Object.entries(data)) {
        if (signal.to !== this.playerId) continue;
        if (signal.processed) continue;

        this.handleSignal(signal.from, signal);

        // Mark as processed
        const signalRef = ref(this.db, `rooms/${ROOM_ID}/signals/${key}`);
        update(signalRef, { processed: true }).catch(() => {});
      }
    });
  }

  async handleSignal(fromId, signal) {
    let player = this.players.get(fromId);

    if (signal.type === 'offer') {
      if (!player) {
        // Incoming connection
        const pc = new RTCPeerConnection(this.iceServers);
        pc.ondatachannel = (event) => {
          const channel = event.channel;
          this.setupDataChannel(fromId, channel);
          if (player) player.dataChannel = channel;
        };
        pc.onicecandidate = (event) => {
          if (event.candidate) this.sendSignal(fromId, { type: 'candidate', candidate: event.candidate });
        };
        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            this.handlePlayerLeave(fromId);
          }
        };

        player = { car: null, peerConnection: pc, dataChannel: null, pendingCandidates: [] };
        this.players.set(fromId, player);
      }

      await player.peerConnection.setRemoteDescription(signal.offer);
      const answer = await player.peerConnection.createAnswer();
      await player.peerConnection.setLocalDescription(answer);
      this.sendSignal(fromId, { type: 'answer', answer });

    } else if (signal.type === 'answer') {
      if (player) {
        await player.peerConnection.setRemoteDescription(signal.answer);
      }

    } else if (signal.type === 'candidate') {
      if (player && player.peerConnection.remoteDescription) {
        try {
          await player.peerConnection.addIceCandidate(signal.candidate);
        } catch (e) {
          // Candidate before remote description - queue it
          player.pendingCandidates.push(signal.candidate);
        }
      } else if (player) {
        player.pendingCandidates.push(signal.candidate);
      }
    }
  }

  startStateBroadcast() {
    // Broadcast local car state at fixed rate
    this.sendInterval = setInterval(() => {
      if (!this.localCar || this.offlineMode) return;

      const state = this.localCar.getNetworkState();
      this.broadcastState(state);

      // Update Firebase presence
      if (this.playerRef && this.db) {
        update(this.playerRef, {
          car: state,
          lastSeen: serverTimestamp()
        }).catch(() => {});
      }
    }, 1000 / CONFIG.multiplayer.stateSendRate);
  }

  broadcastState(state) {
    for (const [id, player] of this.players) {
      if (player.dataChannel && player.dataChannel.readyState === 'open') {
        player.dataChannel.send(JSON.stringify({ type: 'state', payload: state }));
      }
    }
  }

  setLocalCar(car) {
    this.localCar = car;
  }

  getPlayerId() {
    return this.playerId;
  }

  getPlayers() {
    return this.players;
  }

  isConnected() {
    return this.connected || this.offlineMode;
  }

  isOfflineMode() {
    return this.offlineMode;
  }

  disconnect() {
    if (this.sendInterval) clearInterval(this.sendInterval);
    if (this.playerRef && this.db) {
      remove(this.playerRef).catch(() => {});
    }
    for (const [, player] of this.players) {
      player.peerConnection.close();
    }
    this.players.clear();
    this.connected = false;
  }
}

// Export config for user to replace
export { FIREBASE_CONFIG };