using UnityEngine;

public class SideBarGlitch : MonoBehaviour
{
    [Header("Scroll")]
    public float scrollSpeed = -0.5f;

    [Header("Glitch")]
    public float glitchInterval = 3f;
    public float glitchDuration = 0.08f;
    public float glitchStrength = 0.04f;   // max X offset
    public float glitchBandSize = 0.05f;   // rozmiar paska (0-1)

    public bool IsGlitching => _isGlitching;
    public float GetScrollOffset() => _scrollOffset;
    public float GetGlitchPosition() => _mat.GetFloat("_GlitchPosition");
    public float GetGlitchSize() => _mat.GetFloat("_GlitchSize");
    public float GetGlitchOffset() => _mat.GetFloat("_GlitchOffset");

    private Material _mat;
    private float _scrollOffset;
    private float _glitchTimer;
    private float _glitchActiveTimer;
    private bool _isGlitching;

    void Start()
    {
        // Własna instancja materiału żeby nie nadpisywać innych obiektów
        _mat = new Material(GetComponent<SpriteRenderer>().sharedMaterial);
        GetComponent<SpriteRenderer>().material = _mat;
        _glitchTimer = Random.Range(0.5f, glitchInterval);
    }

    void Update()
    {
        // Scrollowanie
        _scrollOffset = Mathf.Repeat(_scrollOffset + scrollSpeed * Time.deltaTime, 1f);
        _mat.SetFloat("_ScrollOffset", _scrollOffset);

        if (_isGlitching)
        {
            // Glitch aktywny — losowy offset X w losowym pasku
            float offset = Random.Range(-glitchStrength, glitchStrength);
            _mat.SetFloat("_GlitchOffset", offset);

            _glitchActiveTimer -= Time.deltaTime;
            if (_glitchActiveTimer <= 0)
            {
                _isGlitching = false;
                _mat.SetFloat("_GlitchOffset", 0f);  // reset
            }
        }
        else
        {
            _glitchTimer -= Time.deltaTime;
            if (_glitchTimer <= 0)
            {
                _isGlitching = true;
                _glitchActiveTimer = glitchDuration;
                _glitchTimer = Random.Range(0.5f, glitchInterval);

                // Nowa losowa pozycja paska przy każdym glitchu
                float bandY = Random.Range(0.1f, 0.9f);
                _mat.SetFloat("_GlitchPosition", bandY);
                _mat.SetFloat("_GlitchSize", glitchBandSize);
            }
        }
    }
}