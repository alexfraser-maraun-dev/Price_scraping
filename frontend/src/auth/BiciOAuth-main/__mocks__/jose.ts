export const createRemoteJWKSet = jest.fn();
export const jwtVerify = jest.fn().mockResolvedValue({
    payload: {
        sub: '1234567890',
        email: 'integration@bici.cc',
        email_verified: true,
        name: 'Integration Test',
        picture: 'http://example.com/pic.jpg',
        iat: Math.floor(Date.now() / 1000)
    }
});
