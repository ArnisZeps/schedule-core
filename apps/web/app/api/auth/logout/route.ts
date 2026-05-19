export async function POST() {
  return new Response(null, {
    status: 204,
    headers: {
      'Set-Cookie': 'sc_token=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
    },
  })
}
