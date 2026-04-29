/**
 * Save/Load Adapter for TradingView with Firebase
 * Lưu và load chart layouts, drawings, indicators từ Firebase Firestore
 */

// ============================================
// FIREBASE CONFIG - Thay thế bằng config của bạn
// ============================================
// const firebaseConfig = {
//     apiKey: "YOUR_API_KEY",
//     authDomain: "YOUR_AUTH_DOMAIN",
//     projectId: "YOUR_PROJECT_ID",
//     storageBucket: "YOUR_STORAGE_BUCKET",
//     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
//     appId: "YOUR_APP_ID"
// };
 const firebaseConfig = {
    apiKey: "AIzaSyCX5ICsjsD0fJFm1jxfUEitBwZ2Ru00fm0",
    authDomain: "papertrading-6332a.firebaseapp.com",
    projectId: "papertrading-6332a",
    storageBucket: "papertrading-6332a.firebasestorage.app",
    messagingSenderId: "11611248436",
    appId: "1:11611248436:web:cfe3c2caad6fa9ae3d3761"
  };
// ============================================
// FIREBASE INITIALIZATION
// ============================================
let db = null;
let currentUserId = 'anonymous'; // Default user ID

// Initialize Firebase
function initializeFirebase() {
    if (!window.firebase) {
        console.error('Firebase SDK not loaded. Please include Firebase scripts in your HTML.');
        return false;
    }

    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('Firebase app initialized');
        } else {
            console.log('Firebase app already initialized');
        }
        db = firebase.firestore();
        console.log('Firestore initialized successfully');
        console.log('Firebase config:', {
            projectId: firebaseConfig.projectId,
            authDomain: firebaseConfig.authDomain
        });
        return true;
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        console.error('Error details:', error.message);
        return false;
    }
}

// Set current user ID (call this after user login)
function setUserId(userId) {
    currentUserId = userId || 'anonymous';
    console.log('User ID set to:', currentUserId);
}

// ============================================
// SAVE/LOAD ADAPTER CLASS
// ============================================
class SaveLoadAdapter {
    constructor(userId = 'anonymous') {
        this.userId = userId;
        this.currentChartId = null;
        this.initialized = false;
        
        // Initialize Firebase
        this.initialized = initializeFirebase();
        
        if (!this.initialized) {
            console.warn('Firebase not initialized. Falling back to localStorage.');
        }
    }

    /**
     * Get Firestore collection reference
     */
    getChartsCollection() {
        if (!db) return null;
        return db.collection('users').doc(this.userId).collection('charts');
    }

    getStudyTemplatesCollection() {
        if (!db) return null;
        return db.collection('users').doc(this.userId).collection('study_templates');
    }

    getDrawingTemplatesCollection() {
        if (!db) return null;
        return db.collection('users').doc(this.userId).collection('drawing_templates');
    }

    /**
     * Get all saved charts from Firebase
     */
    async getAllCharts() {
        if (!this.initialized) {
            console.warn('Firebase not initialized, returning empty array');
            return [];
        }

        try {
            const chartsRef = this.getChartsCollection();
            console.log('Fetching charts from Firebase for user:', this.userId);
            const snapshot = await chartsRef.get();
            
            console.log('Firebase snapshot empty:', snapshot.empty, 'size:', snapshot.size);
            
            if (snapshot.empty) {
                console.log('No charts found in Firebase');
                return [];
            }

            const charts = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                console.log('Found chart:', doc.id, data);
                charts.push({
                    id: doc.id,
                    ...data
                });
            });

            console.log('Total charts loaded from Firebase:', charts.length);
            return charts;
        } catch (error) {
            console.error('Error getting charts from Firebase:', error);
            console.error('Error details:', error.message, error.code);
            return [];
        }
    }

    /**
     * Save chart to Firebase
     */
    async saveChart(chartData) {
        if (!this.initialized) {
            console.warn('Firebase not initialized. Cannot save chart.');
            return chartData.id;
        }

        try {
            const chartsRef = this.getChartsCollection();
            const chartDoc = {
                name: chartData.name,
                symbol: chartData.symbol,
                resolution: chartData.resolution,
                content: chartData.content,
                timestamp: Date.now()
            };

            await chartsRef.doc(chartData.id).set(chartDoc, { merge: true });
            console.log('Chart saved to Firebase with ID:', chartData.id);
            return chartData.id;
        } catch (error) {
            console.error('Error saving chart to Firebase:', error);
            throw error;
        }
    }

    /**
     * Load chart by ID from Firebase
     */
    async loadChart(chartId) {
        if (!this.initialized) {
            return null;
        }

        try {
            const chartsRef = this.getChartsCollection();
            const doc = await chartsRef.doc(chartId).get();
            
            if (doc.exists) {
                return {
                    id: doc.id,
                    ...doc.data()
                };
            }
            return null;
        } catch (error) {
            console.error('Error loading chart from Firebase:', error);
            return null;
        }
    }

    /**
     * Delete chart from Firebase
     */
    async removeChart(chartId) {
        if (!this.initialized) {
            return;
        }

        try {
            const chartsRef = this.getChartsCollection();
            await chartsRef.doc(chartId).delete();
            console.log('Chart removed from Firebase:', chartId);
        } catch (error) {
            console.error('Error removing chart from Firebase:', error);
            throw error;
        }
    }

    /**
     * Get all chart metadata (without content)
     */
    async getAllChartMetadata() {
        const charts = await this.getAllCharts();
        console.log('getAllChartMetadata - charts:', charts);
        const metadata = charts.map(chart => ({
            id: chart.id,
            name: chart.name,
            symbol: chart.symbol,
            resolution: chart.resolution,
            timestamp: chart.timestamp
        }));
        console.log('getAllChartMetadata - returning:', metadata);
        return metadata;
    }

    /**
     * Generate unique chart ID
     */
    generateChartId() {
        return `chart_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    /**
     * Save study template to Firebase
     */
    async saveStudyTemplate(name, content) {
        if (!this.initialized) {
            return;
        }

        try {
            const templatesRef = this.getStudyTemplatesCollection();
            await templatesRef.doc(name).set({
                name: name,
                content: content,
                timestamp: Date.now()
            });
            console.log('Study template saved to Firebase:', name);
        } catch (error) {
            console.error('Error saving study template to Firebase:', error);
            throw error;
        }
    }

    /**
     * Get study template from Firebase
     */
    async getStudyTemplate(name) {
        if (!this.initialized) {
            return null;
        }

        try {
            const templatesRef = this.getStudyTemplatesCollection();
            const doc = await templatesRef.doc(name).get();
            
            if (doc.exists) {
                return doc.data().content;
            }
            return null;
        } catch (error) {
            console.error('Error getting study template from Firebase:', error);
            return null;
        }
    }

    /**
     * Get all study templates from Firebase
     */
    async getAllStudyTemplates() {
        if (!this.initialized) {
            return [];
        }

        try {
            const templatesRef = this.getStudyTemplatesCollection();
            const snapshot = await templatesRef.get();
            
            const templates = [];
            snapshot.forEach(doc => {
                templates.push({ name: doc.id });
            });
            
            return templates;
        } catch (error) {
            console.error('Error getting study templates from Firebase:', error);
            return [];
        }
    }

    /**
     * Remove study template from Firebase
     */
    async removeStudyTemplate(name) {
        if (!this.initialized) {
            return;
        }

        try {
            const templatesRef = this.getStudyTemplatesCollection();
            await templatesRef.doc(name).delete();
            console.log('Study template removed from Firebase:', name);
        } catch (error) {
            console.error('Error removing study template from Firebase:', error);
            throw error;
        }
    }

    /**
     * Save drawing template to Firebase
     */
    async saveDrawingTemplate(toolName, templateName, content) {
        if (!this.initialized) {
            return;
        }

        try {
            const templatesRef = this.getDrawingTemplatesCollection();
            const docId = `${toolName}_${templateName}`;
            
            await templatesRef.doc(docId).set({
                toolName: toolName,
                templateName: templateName,
                content: content,
                timestamp: Date.now()
            });
            console.log('Drawing template saved to Firebase:', docId);
        } catch (error) {
            console.error('Error saving drawing template to Firebase:', error);
            throw error;
        }
    }

    /**
     * Get drawing templates for a tool from Firebase
     */
    async getDrawingTemplates(toolName) {
        if (!this.initialized) {
            return [];
        }

        try {
            const templatesRef = this.getDrawingTemplatesCollection();
            const snapshot = await templatesRef
                .where('toolName', '==', toolName)
                .get();
            
            const templates = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                templates.push({
                    name: data.templateName,
                    content: data.content
                });
            });
            
            return templates;
        } catch (error) {
            console.error('Error getting drawing templates from Firebase:', error);
            return [];
        }
    }

    /**
     * Load drawing template from Firebase
     */
    async loadDrawingTemplate(toolName, templateName) {
        if (!this.initialized) {
            return null;
        }

        try {
            const templatesRef = this.getDrawingTemplatesCollection();
            const docId = `${toolName}_${templateName}`;
            const doc = await templatesRef.doc(docId).get();
            
            if (doc.exists) {
                return doc.data().content;
            }
            return null;
        } catch (error) {
            console.error('Error loading drawing template from Firebase:', error);
            return null;
        }
    }

    /**
     * Remove drawing template from Firebase
     */
    async removeDrawingTemplate(toolName, templateName) {
        if (!this.initialized) {
            return;
        }

        try {
            const templatesRef = this.getDrawingTemplatesCollection();
            const docId = `${toolName}_${templateName}`;
            await templatesRef.doc(docId).delete();
            console.log('Drawing template removed from Firebase:', docId);
        } catch (error) {
            console.error('Error removing drawing template from Firebase:', error);
            throw error;
        }
    }

    /**
     * TradingView Save/Load Adapter Interface
     */
    getAdapter() {
        return {
            // Get all saved charts
            getAllCharts: async () => {
                return await this.getAllChartMetadata();
            },

            // Remove chart
            removeChart: async (chartId) => {
                await this.removeChart(chartId);
            },

            // Save chart
            saveChart: async (chartData) => {
                console.log('SaveLoadAdapter.saveChart called:', chartData);
                const chartId = chartData.id || this.generateChartId();
                const dataToSave = {
                    id: chartId,
                    name: chartData.name,
                    symbol: chartData.symbol,
                    resolution: chartData.resolution,
                    content: chartData.content
                };
                await this.saveChart(dataToSave);
                console.log('Chart saved to Firebase with ID:', chartId);
                return chartId;
            },

            // Get chart content
            getChartContent: async (chartId) => {
                const chart = await this.loadChart(chartId);
                return chart ? chart.content : null;
            },

            // Remove study template
            removeStudyTemplate: async (studyTemplateData) => {
                await this.removeStudyTemplate(studyTemplateData.name);
            },

            // Get study template content
            getStudyTemplateContent: async (studyTemplateData) => {
                return await this.getStudyTemplate(studyTemplateData.name);
            },

            // Save study template
            saveStudyTemplate: async (studyTemplateData) => {
                await this.saveStudyTemplate(studyTemplateData.name, studyTemplateData.content);
            },

            // Get all study templates
            getAllStudyTemplates: async () => {
                return await this.getAllStudyTemplates();
            },

            // Get drawing templates
            getDrawingTemplates: async (toolName) => {
                return await this.getDrawingTemplates(toolName);
            },

            // Load drawing template
            loadDrawingTemplate: async (toolName, templateName) => {
                return await this.loadDrawingTemplate(toolName, templateName);
            },

            // Remove drawing template
            removeDrawingTemplate: async (toolName, templateName) => {
                await this.removeDrawingTemplate(toolName, templateName);
            },

            // Save drawing template
            saveDrawingTemplate: async (toolName, templateName, content) => {
                await this.saveDrawingTemplate(toolName, templateName, content);
            }
        };
    }
}

// Export
window.SaveLoadAdapter = SaveLoadAdapter;
window.setFirebaseUserId = setUserId;
