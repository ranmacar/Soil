import { Router } from 'itty-router';
import { Storage } from '../utils/storage';

const router = Router();

// GET /ideas - List all ideas
router.get('/', async (request, env) => {
    const storage = new Storage(env);
    const ideas = await storage.getJson('ideas.json') || [];

    return new Response(JSON.stringify(ideas), {
        headers: { 'Content-Type': 'application/json' },
    });
});

// GET /ideas/:id - Get specific idea
router.get('/:id', async (request, env) => {
    const { id } = request.params;
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
});

// POST /ideas - Submit new idea
router.post('/', async (request, env) => {
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
});

// PUT /ideas/:id - Update idea (owner only)
router.put('/:id', async (request, env) => {
    try {
        const { id } = request.params;
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

        // In a real implementation, check if user owns this idea
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
});

// DELETE /ideas/:id - Delete idea (owner only)
router.delete('/:id', async (request, env) => {
    const { id } = request.params;
    const storage = new Storage(env);
    const ideas = await storage.getJson('ideas.json') || [];

    const ideaIndex = ideas.findIndex(i => i.id === id);
    if (ideaIndex === -1) {
        return new Response(JSON.stringify({ error: 'Idea not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // In a real implementation, check if user owns this idea
    ideas.splice(ideaIndex, 1);
    await storage.putJson('ideas.json', ideas);

    return new Response(JSON.stringify({ message: 'Idea deleted' }), {
        headers: { 'Content-Type': 'application/json' },
    });
});

export const ideasRouter = router;