export class Storage {
    constructor(r2, bucketName = 'SOIL_DATA') {
        this.r2 = r2[bucketName];
    }

    async getJson(key) {
        try {
            const object = await this.r2.get(key);
            if (!object) return null;

            const text = await object.text();
            return JSON.parse(text);
        } catch (error) {
            console.error(`Error reading ${key}:`, error);
            return null;
        }
    }

    async putJson(key, data) {
        try {
            const jsonString = JSON.stringify(data, null, 2);
            await this.r2.put(key, jsonString, {
                httpMetadata: {
                    contentType: 'application/json',
                    cacheControl: 'public, max-age=300',
                },
            });
            return true;
        } catch (error) {
            console.error(`Error writing ${key}:`, error);
            return false;
        }
    }

    async list(prefix = '') {
        try {
            const objects = await this.r2.list({ prefix });
            return objects.objects || [];
        } catch (error) {
            console.error(`Error listing objects with prefix ${prefix}:`, error);
            return [];
        }
    }

    async delete(key) {
        try {
            await this.r2.delete(key);
            return true;
        } catch (error) {
            console.error(`Error deleting ${key}:`, error);
            return false;
        }
    }

    async appendToArray(key, item) {
        const data = await this.getJson(key) || [];
        data.push(item);
        return await this.putJson(key, data);
    }

    async updateInArray(key, predicate, updateFn) {
        const data = await this.getJson(key) || [];
        const index = data.findIndex(predicate);
        if (index !== -1) {
            data[index] = updateFn(data[index]);
            return await this.putJson(key, data);
        }
        return false;
    }

    async removeFromArray(key, predicate) {
        const data = await this.getJson(key) || [];
        const filtered = data.filter(item => !predicate(item));
        return await this.putJson(key, filtered);
    }
}