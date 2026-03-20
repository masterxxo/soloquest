using UnityEngine;

public class TextureScroller : MonoBehaviour
{
    public float scrollSpeed = -0.5f;
    public float glitchInterval = 3f;
    public float glitchDuration = 0.1f;
    public float glitchStrength = 0.05f;

    private Material _material;
    private float _glitchTimer;
    private float _glitchActiveTimer;
    private bool _isGlitching;

    void Start()
    {
        _material = GetComponent<SpriteRenderer>().material;
        _glitchTimer = Random.Range(1f, glitchInterval);
    }

    void Update()
    {
        float offset = Time.time * scrollSpeed;

        if (_isGlitching)
        {
            float glitchX = Random.Range(-glitchStrength, glitchStrength);
            _material.SetTextureOffset("_MainTex", new Vector2(glitchX, offset));

            _glitchActiveTimer -= Time.deltaTime;
            if (_glitchActiveTimer <= 0)
                _isGlitching = false;
        }
        else
        {
            _material.SetTextureOffset("_MainTex", new Vector2(0, offset));

            _glitchTimer -= Time.deltaTime;
            if (_glitchTimer <= 0)
            {
                _isGlitching = true;
                _glitchActiveTimer = glitchDuration;
                _glitchTimer = Random.Range(1f, glitchInterval);
            }
        }
    }
}