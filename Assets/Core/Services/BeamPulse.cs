using UnityEngine;

public class BeamPulse : MonoBehaviour
{
    public float minAlpha = 0.6f;
    public float maxAlpha = 1.0f;
    public float speed = 1.2f;

    private SpriteRenderer _sr;

    void Start()
    {
        _sr = GetComponent<SpriteRenderer>();
    }

    void Update()
    {
        float alpha = Mathf.Lerp(minAlpha, maxAlpha, (Mathf.Sin(Time.time * speed) + 1f) / 2f);
        Color c = _sr.color;
        c.a = alpha;
        _sr.color = c;
    }
}