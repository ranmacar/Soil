import { Storage } from '../utils/storage';

export const handleIdeas = {
    async getAll(request, env) {
        const storage = new Storage(env);
        const ideas = await storage.getJson('ideas.json') || [];

        return new Response(JSON.stringify(ideas), {
            headers: { 'Content-Type': 'application/json' },
        });
    },

    async getById(request, env, params) {
        const { id } = params;
        const storage = new Storage(env);
        const ideas = await storage.getJson('ideas.json') || [];

        const idea = ideas.find(i => i.id === id);
        if (!idea) {
            return new Response(JSON.stringify({ error: 'Idea not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify(idea), {
            headers: { 'Content-Type': 'application/json' },
        });
    },

    async create(request, env) {
        try {
            const body = await request.json();
            const { title, description, submitter } = body;

            if (!title || !description || !submitter) {
                return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            const storage = new Storage(env);
            const ideas = await storage.getJson('ideas.json') || [];

            const newIdea = {
                id: `idea_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                title,
                description,
                submitter,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            ideas.push(newIdea);
            await storage.putJson('ideas.json', ideas);

            return new Response(JSON.stringify(newIdea), {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: 'Invalid request body' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    },

    async update(request, env, params) {
        try {
            const { id } = params;
            const body = await request.json();
            const { title, description } = body;

            const storage = new Storage(env);
            const ideas = await storage.getJson('ideas.json') || [];

            const ideaIndex = ideas.findIndex(i => i.id === id);
            if (ideaIndex === -1) {
                return new Response(JSON.stringify({ error: 'Idea not found' }), {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            ideas[ideaIndex] = {
                ...ideas[ideaIndex],
                title: title || ideas[ideaIndex].title,
                description: description || ideas[ideaIndex].description,
                updatedAt: new Date().toISOString(),
            };

            await storage.putJson('ideas.json', ideas);

            return new Response(JSON.stringify(ideas[ideaIndex]), {
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: 'Invalid request body' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    },

    async delete(request, env, params) {
        const { id } = params;
        const storage = new Storage(env);
        const ideas = await storage.getJson('ideas.json') || [];

        const ideaIndex = ideas.findIndex(i => i.id === id);
        if (ideaIndex === -1) {
            return new Response(JSON.stringify({ error: 'Idea not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        ideas.splice(ideaIndex, 1);
        await storage.putJson('ideas.json', ideas);

        return new Response(JSON.stringify({ message: 'Idea deleted' }), {
            headers: { 'Content-Type': 'application/json' },
        });
    }
};