using UnityEngine;

public class SideBarBlur : MonoBehaviour
{
    public SideBarGlitch glitchSource;
    public float blurAlpha = 0.3f;
    public float blurOffset = 0.02f;

    private SpriteRenderer _sr;
    private Material _mat;

    void Start()
    {
        _sr = GetComponent<SpriteRenderer>();
        _mat = new Material(GetComponent<SpriteRenderer>().sharedMaterial);
        _sr.material = _mat;

        Color c = _sr.color;
        c.a = 0f;
        _sr.color = c;
    }

    void Update()
    {
        // Kopiuj scroll z rodzica
        float scroll = glitchSource.GetScrollOffset();
        _mat.SetFloat("_ScrollOffset", scroll);
        _mat.SetFloat("_GlitchPosition", glitchSource.GetGlitchPosition());
        _mat.SetFloat("_GlitchSize", glitchSource.GetGlitchSize());
        _mat.SetFloat("_GlitchOffset", glitchSource.GetGlitchOffset() + blurOffset);

        // Alpha
        Color c = _sr.color;
        float targetAlpha = glitchSource.IsGlitching ? blurAlpha : 0f;
        c.a = Mathf.Lerp(c.a, targetAlpha, Time.deltaTime * 10f);
        _sr.color = c;
    }
}